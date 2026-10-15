/**
 * ============================================================
 * CogniCare - server/routes/auth.js
 * ------------------------------------------------------------
 * ACCOUNT ROUTES   (FR001 login, FR002 register)
 *
 *   POST /api/auth/register   create an account  -> { token, user }
 *   POST /api/auth/login      log in              -> { token, user }
 *   GET  /api/auth/me         who am I? (needs token) -> { user }
 *
 * Every error answer looks like:
 *   { "error": "readable English text", "key": "errWrongLogin" }
 * `key` is a translation key that already exists in translations.js,
 * so the website can show the message in BM or EN: t(response.key).
 *
 * SECURITY DONE HERE
 *  - Passwords are hashed with bcrypt (cost 12). The plain password
 *    is never stored or logged.
 *  - Wrong email and wrong password give the SAME message, so nobody
 *    can find out which emails are registered.
 *  - After 5 wrong tries (same email + same computer) the login is
 *    locked for 15 minutes.
 *  - Nobody can register as "admin". The first admin is promoted
 *    by hand in MySQL (see schema.sql).
 *  - All SQL uses ? placeholders (in userService.js).
 *
 * LOG OUT needs no route: the token lives in the browser, so the
 * website just deletes it.
 * ============================================================
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { signToken, requireAuth } from "../middleware/auth.js";
import { createUser, findForLogin } from "../services/userService.js";
import { friendlyDbError } from "../db.js";

const router = Router();

// ------------------------------------------------------------
// 1. SETTINGS
// ------------------------------------------------------------
const BCRYPT_COST = 12;
const MIN_PASSWORD = 6;          // same as the hint on register.html
const MAX_PASSWORD_BYTES = 72;   // bcrypt only reads the first 72 bytes
const SELF_REGISTER_ROLES = ["elderly", "caregiver"];   // never "admin"
const LANGUAGES = ["bm", "en"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

// A real bcrypt hash of a throw-away text. Used when the email does
// not exist, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);

// ------------------------------------------------------------
// 2. SMALL HELPERS
// ------------------------------------------------------------

/** Send an error in the standard shape. */
function fail(res, status, error, key = "errGeneric") {
  return res.status(status).json({ error, key });
}

/** Check the register form. Returns { problem } or { value }. */
function validateRegistration(body) {
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const age = Number(body.age);
  const role = body.role;
  const languagePreference = body.languagePreference ?? "bm";

  if (name.length < 1 || name.length > 100) {
    return { problem: ["Name is required (up to 100 characters).", "errGeneric"] };
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 150) {
    return { problem: ["That email address does not look right.", "errInvalidEmail"] };
  }
  if (password.length < MIN_PASSWORD) {
    return { problem: [`Password must be at least ${MIN_PASSWORD} characters.`, "errWeakPassword"] };
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return { problem: [`Password is too long (max ${MAX_PASSWORD_BYTES} bytes).`, "errWeakPassword"] };
  }
  if (!Number.isInteger(age) || age < 1 || age > 120) {
    return { problem: ["A valid age (1-120) is required.", "errGeneric"] };
  }
  if (!SELF_REGISTER_ROLES.includes(role)) {
    return { problem: ["Please choose a valid role.", "errGeneric"] };
  }
  if (!LANGUAGES.includes(languagePreference)) {
    return { problem: ["Invalid language.", "errGeneric"] };
  }
  return { value: { name, email, password, age, role, languagePreference } };
}

// ---- failed-login counter (kept in memory; resets if the server restarts) ----
const failedLogins = new Map(); // "ip|email" -> { count, firstAt }

function lockKey(req, email) {
  return `${req.ip}|${email}`;
}
function isLocked(key) {
  const entry = failedLogins.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOCK_MINUTES * 60_000) {
    failedLogins.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILED_LOGINS;
}
function recordFailure(key) {
  const entry = failedLogins.get(key);
  if (!entry || Date.now() - entry.firstAt > LOCK_MINUTES * 60_000) {
    failedLogins.set(key, { count: 1, firstAt: Date.now() });
  } else {
    entry.count += 1;
  }
}
// Remove old entries now and then so the Map cannot grow forever.
setInterval(() => {
  const limit = Date.now() - LOCK_MINUTES * 60_000;
  for (const [key, entry] of failedLogins) {
    if (entry.firstAt < limit) failedLogins.delete(key);
  }
}, 10 * 60_000).unref();

// ------------------------------------------------------------
// 3. POST /api/auth/register
// ------------------------------------------------------------
router.post("/register", async (req, res, next) => {
  try {
    const { problem, value } = validateRegistration(req.body ?? {});
    if (problem) return fail(res, 400, problem[0], problem[1]);

    const passwordHash = await bcrypt.hash(value.password, BCRYPT_COST);

    let user;
    try {
      user = await createUser({
        name: value.name,
        email: value.email,
        passwordHash,
        age: value.age,
        role: value.role,
        languagePreference: value.languagePreference,
      });
    } catch (err) {
      // The UNIQUE rule on users.email is enforced by MySQL itself.
      if (err.errno === 1062) return fail(res, 409, "This email is already registered.", "errEmailUsed");
      const { status, message } = friendlyDbError(err);
      return fail(res, status, message);
    }

    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// 4. POST /api/auth/login
// ------------------------------------------------------------
router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!EMAIL_PATTERN.test(email) || password.length === 0) {
      return fail(res, 400, "Email and password are required.", "errWrongLogin");
    }

    const key = lockKey(req, email);
    if (isLocked(key)) {
      return fail(res, 429, `Too many tries. Please wait ${LOCK_MINUTES} minutes and try again.`, "errTooMany");
    }

    const found = await findForLogin(email);
    // Always run bcrypt, even when the email does not exist (same timing).
    const passwordOk = await bcrypt.compare(password, found ? found.passwordHash : DUMMY_HASH);

    if (!found || !passwordOk) {
      recordFailure(key);
      return fail(res, 401, "Email or password is incorrect.", "errWrongLogin");
    }
    if (!found.user.isActive) {
      return fail(res, 403, "This account has been disabled. Please contact the administrator.", "errGeneric");
    }

    failedLogins.delete(key);
    res.json({ token: signToken(found.user), user: found.user });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// 5. GET /api/auth/me   (the website calls this when a page opens)
// ------------------------------------------------------------
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;