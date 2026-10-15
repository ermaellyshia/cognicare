/**
 * ============================================================
 * CogniCare - server/middleware/auth.js
 * ------------------------------------------------------------
 * AUTHENTICATION and AUTHORIZATION  (A251: "validation,
 * authorization dan data integrity")
 *
 *   Authentication  = WHO are you?        -> requireAuth
 *   Authorization   = WHAT may you do?    -> requireRole
 *
 * HOW LOGIN WORKS
 *   1. The user logs in with email + password.
 *   2. The server gives back a TOKEN (JWT): a signed text that says
 *      "this is user 7". It is signed with JWT_SECRET, so nobody
 *      can fake or change it.
 *   3. The website sends the token with every request:
 *          Authorization: Bearer <token>
 *   4. requireAuth checks the signature and the expiry, then loads
 *      the user from MySQL again. So a deactivated account or a
 *      changed role takes effect immediately, even if the token
 *      itself has not expired yet.
 *
 * HOW A ROUTE USES IT
 *   router.get("/me", requireAuth, handler);                    // any logged-in user
 *   router.get("/users", requireAuth, requireRole("admin"), handler);   // admin only
 *   Inside the handler, the user is in  req.user.
 *
 * The role is ALWAYS taken from MySQL, never from what the browser
 * says, so a user cannot make themselves an admin.
 * ============================================================
 */

import jwt from "jsonwebtoken";
import { getUserById } from "../services/userService.js";

// ------------------------------------------------------------
// 1. SETTINGS  (stop at start-up if the secret is not safe)
// ------------------------------------------------------------
const SECRET = process.env.JWT_SECRET || "";
if (SECRET.length < 32 || SECRET.startsWith("GANTI")) {
  throw new Error(
    "JWT_SECRET in server/.env is missing or too short (needs 32+ characters). " +
      "Create one with:  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const ALGORITHM = "HS256";

// ------------------------------------------------------------
// 2. CREATE A TOKEN  (used by login and register)
// ------------------------------------------------------------

/**
 * @param {{userId:number, role:string}} user
 * @returns {string} the signed token
 */
export function signToken(user) {
  return jwt.sign({ role: user.role }, SECRET, {
    subject: String(user.userId),
    expiresIn: EXPIRES_IN,
    algorithm: ALGORITHM,
  });
}

// ------------------------------------------------------------
// 3. AUTHENTICATION: "are you logged in?"
// ------------------------------------------------------------

/** Pull the token out of "Authorization: Bearer <token>". */
function readToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) {
      return res.status(401).json({ error: "Please log in first." });
    }

    let payload;
    try {
      // Only HS256 is accepted (blocks the "alg: none" trick).
      payload = jwt.verify(token, SECRET, { algorithms: [ALGORITHM] });
    } catch (err) {
      const expired = err.name === "TokenExpiredError";
      return res.status(401).json({
        error: expired ? "Your session has expired. Please log in again." : "Invalid login. Please log in again.",
        code: expired ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
      });
    }

    // Load the CURRENT user from MySQL (role, active status)
    const user = await getUserById(Number(payload.sub));
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "This account is not available.", code: "ACCOUNT_UNAVAILABLE" });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err); // goes to the error handler in server.js
  }
}

// ------------------------------------------------------------
// 4. AUTHORIZATION: "are you allowed to do this?"
// ------------------------------------------------------------

/**
 * Use AFTER requireAuth.
 *   requireRole("admin")
 *   requireRole("caregiver", "admin")
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to do this." });
    }
    next();
  };
}