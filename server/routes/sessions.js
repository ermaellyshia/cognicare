/**
 * ============================================================
 * CogniCare - server/routes/sessions.js
 * ------------------------------------------------------------
 * GAME SESSION ROUTES   (FR016 save, FR017/FR019-FR021 read)
 *
 *   POST /api/sessions          save a finished game
 *   GET  /api/sessions          sessions of one user (oldest -> newest)
 *                               ?userId=7&gameType=All|N-Back|Match-3
 *   GET  /api/sessions/all      sessions of everybody       (admin only)
 *   GET  /api/sessions/streak   days in a row played
 *                               ?userId=7&tz=+08:00
 *
 * WHO MAY DO WHAT  (authorization)
 *  - A game is ALWAYS saved for the logged-in user. The user id sent
 *    by the browser is ignored, so nobody can save a score for
 *    somebody else.
 *  - You may read your own sessions. An admin may read anyone's.
 *    (Caregivers reading their linked elderly users' sessions is
 *    added together with the caregiver-link routes.)
 *
 * Answers:  { session } | { sessions } | { streak }
 * Errors :  { error, key }   (same shape as auth.js)
 * ============================================================
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { saveSession, getUserSessions, getAllSessions, getPlayStreak } from "../services/sessionService.js";
import { friendlyDbError } from "../db.js";

const router = Router();
const GAME_FILTERS = ["All", "N-Back", "Match-3", "Card Pairs", "Find the Target", "Quick Tap"]
// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function fail(res, status, error, key = "errGeneric") {
  return res.status(status).json({ error, key });
}

/** Turn an error from the service layer into an HTTP answer. */
function sendError(res, err) {
  if (err.status === 400) return fail(res, 400, err.message); // our own validation text
  const { status, message } = friendlyDbError(err);
  return fail(res, status, message);
}

/**
 * Which user's data is being asked for, and may the caller see it?
 * @returns {{userId:number}|{problem:[number,string]}}
 */
function resolveTargetUser(req) {
  const raw = req.query.userId;
  const userId = raw === undefined ? req.user.userId : Number(raw);
  if (!Number.isInteger(userId) || userId < 1) return { problem: [400, "userId is not valid."] };

  const isSelf = userId === req.user.userId;
  const isAdmin = req.user.role === "admin";
  if (!isSelf && !isAdmin) return { problem: [403, "You do not have permission to see this user."] };
  return { userId };
}

function readGameFilter(req) {
  const gameType = req.query.gameType ?? "All";
  return GAME_FILTERS.includes(gameType) ? gameType : null;
}

// ------------------------------------------------------------
// POST /api/sessions
// ------------------------------------------------------------
router.post("/", requireAuth, async (req, res) => {
  try {
    // userId comes from the TOKEN (req.user), never from the request body.
    const session = await saveSession(req.user.userId, req.body ?? {});
    res.status(201).json({ session });
  } catch (err) {
    sendError(res, err);
  }
});

// ------------------------------------------------------------
// GET /api/sessions/all   (admin)       - put before "/" routes with ids
// ------------------------------------------------------------
router.get("/all", requireAuth, requireRole("admin"), async (req, res) => {
  const gameType = readGameFilter(req);
  if (!gameType) return fail(res, 400, "All, N-Back, Match-3, Card Pairs, Find the Target or Quick Tap");
  try {
    res.json({ sessions: await getAllSessions(gameType) });
  } catch (err) {
    sendError(res, err);
  }
});

// ------------------------------------------------------------
// GET /api/sessions/streak
// ------------------------------------------------------------
router.get("/streak", requireAuth, async (req, res) => {
  const target = resolveTargetUser(req);
  if (target.problem) return fail(res, ...target.problem);
  try {
    res.json({ streak: await getPlayStreak(target.userId, req.query.tz) });
  } catch (err) {
    sendError(res, err);
  }
});

// ------------------------------------------------------------
// GET /api/sessions
// ------------------------------------------------------------
router.get("/", requireAuth, async (req, res) => {
  const target = resolveTargetUser(req);
  if (target.problem) return fail(res, ...target.problem);
  const gameType = readGameFilter(req);
  if (!gameType) return fail(res, 400, "gameType must be All, N-Back, Match-3 or Card Pairs.");
  try {
    res.json({ sessions: await getUserSessions(target.userId, gameType) });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;