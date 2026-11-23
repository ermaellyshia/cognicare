/**
 * ============================================================
 * CogniCare - server/services/sessionService.js
 * ------------------------------------------------------------
 * SERVICE LAYER for game sessions (FR016 save, FR017/FR019/FR020/
 * FR021 read for the dashboard).
 *
 *   routes (HTTP)  ->  services (SQL + rules)  ->  db.js
 *
 * SHAPE OF A SESSION OBJECT (same names the website already uses):
 *   { sessionId, userId, gameType, difficultyLevel, score,
 *     duration, completed, datePlayed,
 *     hitCount, missCount, falseAlarmCount, rejectCount,   (AI data)
 *     accuracyPct, hitRatePct, falseAlarmPct, avgResponseMs }
 *   The AI fields are null for games saved before migration_001.
 *   gameType        "N-Back" | "Match-3"
 *   difficultyLevel "2-back"  | "4x4"
 *   duration        seconds
 *
 * The database stores a level_id instead of the two texts; the view
 * v_session_details (schema.sql) joins them back together.
 * ============================================================
 */

import { query, queryOne, execute } from "../db.js";

const MAX_ROWS = 5000; // safety limit for one dashboard request

/** An error the route can show to the user as-is. */
function badInput(message) {
  return Object.assign(new Error(message), { status: 400 });
}

/** Database row (from v_session_details) -> object for the website. */
function toSession(row) {
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    gameType: row.game_type,
    difficultyLevel: row.difficulty_level,
    score: row.score,
    duration: row.duration,
    completed: Boolean(row.completed),
    datePlayed: row.played_at,
    // AI data (null for old games). MySQL gives ROUND() back as text, so
    // toNumberOrNull turns it into a real number.
    hitCount: toNumberOrNull(row.hit_count),
    missCount: toNumberOrNull(row.miss_count),
    falseAlarmCount: toNumberOrNull(row.false_alarm_count),
    rejectCount: toNumberOrNull(row.reject_count),
    accuracyPct: toNumberOrNull(row.accuracy_pct),
    hitRatePct: toNumberOrNull(row.hit_rate_pct),
    falseAlarmPct: toNumberOrNull(row.false_alarm_pct),
    avgResponseMs: toNumberOrNull(row.avg_response_ms),
  };
}

function toNumberOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

/**
 * Read the optional AI data sent by the game.
 * Either ALL four counts are sent (whole numbers 0..1000) or none.
 * @returns {null | {hits, misses, falseAlarms, rejects, avgResponseMs}}
 */
function readAnswerCounts(result) {
  const names = ["hitCount", "missCount", "falseAlarmCount", "rejectCount"];
  const given = names.filter((n) => result?.[n] !== undefined && result?.[n] !== null);
  if (given.length === 0) return null;
  if (given.length !== names.length) {
    throw badInput("Send all four answer counts (hit, miss, false alarm, reject) or none.");
  }
  const values = names.map((n) => Number(result[n]));
  if (values.some((v) => !Number.isInteger(v) || v < 0 || v > 1000)) {
    throw badInput("Answer counts must be whole numbers from 0 to 1000.");
  }

  let avgResponseMs = null;
  if (result.avgResponseMs !== undefined && result.avgResponseMs !== null) {
    avgResponseMs = Math.round(Number(result.avgResponseMs));
    if (!Number.isFinite(avgResponseMs) || avgResponseMs < 0 || avgResponseMs > 600_000) {
      throw badInput("Average response time must be between 0 and 600000 ms.");
    }
  }
  const [hits, misses, falseAlarms, rejects] = values;
  return { hits, misses, falseAlarms, rejects, avgResponseMs };
}

// ------------------------------------------------------------
// 1. SAVE  (FR016)
// ------------------------------------------------------------

/**
 * Save one finished game.
 * @param {number} userId
 * @param {{gameType:string, difficultyLevel:string, score:number,
 *          duration?:number, completed?:boolean,
 *          hitCount?:number, missCount?:number, falseAlarmCount?:number,
 *          rejectCount?:number, avgResponseMs?:number}} result
 * @returns the saved session
 */
export async function saveSession(userId, result) {
  const gameType = String(result?.gameType ?? "");
  const difficultyLevel = String(result?.difficultyLevel ?? "");
  const score = Number(result?.score);
  const duration = Math.round(Number(result?.duration ?? 0));
  const completed = result?.completed !== false;

  if (!Number.isInteger(score) || score < 0 || score > 1_000_000) {
    throw badInput("Score must be a whole number of 0 or more.");
  }
  if (!Number.isFinite(duration) || duration < 0 || duration > 86_400) {
    throw badInput("Duration must be between 0 and 86400 seconds.");
  }

  const counts = readAnswerCounts(result); // optional AI data

  // The game + level must exist in the lookup tables (seeded by schema.sql).
  const level = await queryOne(
    `SELECT l.level_id
     FROM difficulty_levels l
     JOIN game_types g ON g.game_type_id = l.game_type_id
     WHERE g.game_name = ? AND l.level_label = ?`,
    [gameType, difficultyLevel]
  );
  if (!level) throw badInput("Unknown game type or difficulty level.");

  const saved = await execute(
    `INSERT INTO game_sessions
       (user_id, level_id, score, hit_count, miss_count, false_alarm_count,
        reject_count, avg_response_ms, duration_sec, completed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      level.level_id,
      score,
      counts?.hits ?? null,
      counts?.misses ?? null,
      counts?.falseAlarms ?? null,
      counts?.rejects ?? null,
      counts?.avgResponseMs ?? null,
      duration,
      completed ? 1 : 0,
    ]
  );
  return getSessionById(saved.insertId);
}

export async function getSessionById(sessionId) {
  const row = await queryOne("SELECT * FROM v_session_details WHERE session_id = ?", [sessionId]);
  return row ? toSession(row) : null;
}

// ------------------------------------------------------------
// 2. READ
// ------------------------------------------------------------

/**
 * Sessions of ONE user, oldest -> newest (the order Chart.js needs).
 * @param {"All"|"N-Back"|"Match-3"} gameType
 */
export async function getUserSessions(userId, gameType = "All") {
  const filter = gameType === "All" ? "" : "AND game_type = ?";
  const params = gameType === "All" ? [userId] : [userId, gameType];
  const rows = await query(
    `SELECT * FROM v_session_details
     WHERE user_id = ? ${filter}
     ORDER BY played_at ASC, session_id ASC
     LIMIT ${MAX_ROWS}`,
    params
  );
  return rows.map(toSession);
}

/** Admin (FR019): sessions of ALL users, oldest -> newest. */
export async function getAllSessions(gameType = "All") {
  const filter = gameType === "All" ? "" : "WHERE game_type = ?";
  const params = gameType === "All" ? [] : [gameType];
  // Take the NEWEST rows (up to the limit), then put them oldest-first.
  const rows = await query(
    `SELECT * FROM v_session_details ${filter}
     ORDER BY played_at DESC, session_id DESC
     LIMIT ${MAX_ROWS}`,
    params
  );
  return rows.reverse().map(toSession);
}

// ------------------------------------------------------------
// 3. NUMBERS FOR THE DASHBOARD CARDS  (calculated by MySQL)
// ------------------------------------------------------------

/** @returns {{totalGames:number, averageScore:number, bestScore:number}} */
export async function getStats(userId, gameType = "All") {
  const filter = gameType === "All" ? "" : "AND game_type = ?";
  const params = gameType === "All" ? [userId] : [userId, gameType];
  const row = await queryOne(
    `SELECT COUNT(*) AS total, AVG(score) AS average, MAX(score) AS best
     FROM v_session_details
     WHERE user_id = ? ${filter}`,
    params
  );
  return {
    totalGames: Number(row.total),
    averageScore: row.average === null ? 0 : Math.round(Number(row.average) * 10) / 10,
    bestScore: row.best === null ? 0 : Number(row.best),
  };
}

/**
 * Days in a row (ending today or yesterday) with at least one game.
 * Dates are stored in UTC, so the day boundaries are worked out in the
 * user's time zone (default Malaysia, +08:00).
 * @param {string} tzOffset  like "+08:00"
 */
export async function getPlayStreak(userId, tzOffset = "+08:00") {
  if (!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(tzOffset)) tzOffset = "+08:00";

  const [days, today] = await Promise.all([
    query(
      `SELECT DISTINCT DATE_FORMAT(CONVERT_TZ(played_at, '+00:00', ?), '%Y-%m-%d') AS day
       FROM game_sessions
       WHERE user_id = ?
       ORDER BY day DESC`,
      [tzOffset, userId]
    ),
    queryOne(
      "SELECT DATE_FORMAT(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', ?), '%Y-%m-%d') AS day",
      [tzOffset]
    ),
  ]);
  if (days.length === 0) return 0;

  const played = new Set(days.map((d) => d.day));
  const shift = (text, delta) => {
    const [y, m, d] = text.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
  };

  // Count backwards from today (or yesterday if not played yet today)
  let cursor = today.day;
  if (!played.has(cursor)) cursor = shift(cursor, -1);
  let streak = 0;
  while (played.has(cursor)) {
    streak += 1;
    cursor = shift(cursor, -1);
  }
  return streak;
}