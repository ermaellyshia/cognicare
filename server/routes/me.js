/**
 * ============================================================
 * CogniCare - server/routes/me.js
 * ------------------------------------------------------------
 * "ME" ROUTES: things the logged-in user does to their OWN account.
 *
 *   GET  /api/me           the current user (includes disclaimerAcceptedAt, focusArea)
 *   PUT  /api/me/consent   accept the disclaimer (mandatory for new users)
 *   PUT  /api/me/focus     choose the starting category
 *                          body: { "focusArea": "memory" | "attention" | "speed" | null }
 *
 * The user is ALWAYS the one in the token (req.user). The browser
 * cannot say "change user 7", so nobody can change someone else.
 *
 * Answers:  { user }
 * Errors :  { error, key }   (same shape as sessions.js)
 * ============================================================
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { acceptDisclaimer, setFocusArea } from "../services/userService.js";
import { friendlyDbError } from "../db.js";

const router = Router();

function fail(res, status, error, key = "errGeneric") {
  return res.status(status).json({ error, key });
}

/** Turn an error from the service layer into an HTTP answer. */
function sendError(res, err) {
  if (err.status === 400) return fail(res, 400, err.message);
  const { status, message } = friendlyDbError(err);
  return fail(res, status, message);
}

// ------------------------------------------------------------
// GET /api/me
// ------------------------------------------------------------
router.get("/", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ------------------------------------------------------------
// PUT /api/me/consent
// ------------------------------------------------------------
router.put("/consent", requireAuth, async (req, res) => {
  try {
    res.json({ user: await acceptDisclaimer(req.user.userId) });
  } catch (err) {
    sendError(res, err);
  }
});

// ------------------------------------------------------------
// PUT /api/me/focus
// ------------------------------------------------------------
router.put("/focus", requireAuth, async (req, res) => {
  const body = req.body ?? {};
  // The field must be present. null is allowed ("not sure").
  if (!Object.prototype.hasOwnProperty.call(body, "focusArea")) {
    return fail(res, 400, "focusArea is required (use null if the user is not sure).");
  }
  try {
    res.json({ user: await setFocusArea(req.user.userId, body.focusArea) });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;