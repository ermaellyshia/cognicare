/* ============================================================
 * CogniCare - database/migration_001_ai_metrics.sql   (version 2)
 * ------------------------------------------------------------
 * WHY THIS FILE EXISTS
 *   The AI recommender needs more than "score + level". The game
 *   knows how the player answered, but did not SAVE it.
 *
 * WHAT IT ADDS to game_sessions  (N-Back: every answer is YES or NO)
 *   hit_count          YES when it WAS a match          (correct)
 *   miss_count         NO  when it WAS a match          (wrong)
 *   false_alarm_count  YES when it was NOT a match      (wrong)
 *   reject_count       NO  when it was NOT a match      (correct)
 *   avg_response_ms    average time to answer (milliseconds)
 *
 *   WHY FOUR COUNTS AND NOT JUST "CORRECT / WRONG"?
 *   About 35% of the numbers are matches, so a player who presses NO
 *   every time still scores about 65% "accuracy". Plain accuracy would
 *   make that player look good. With the four counts the AI can look at
 *   hit rate and false-alarm rate separately (balanced accuracy), so
 *   pressing the same button every time gets a score near 50%, which is
 *   what guessing really is.
 *
 *   All five columns are NULL for games saved before this migration,
 *   so old rows stay valid. The recommender skips NULL values.
 *
 * 3NF NOTE (for the report)
 *   Accuracy and the rates are NOT stored. They are calculated from the
 *   counts (in the view). Storing them too would repeat the same fact
 *   in two places (a derived column breaks 3NF).
 *
 * HOW TO RUN  (once only):
 *     cd /Users/ermaellyshia/Documents/cognicare/database
 *     mysql -u root -p < migration_001_ai_metrics.sql
 *
 * ALREADY RAN THE FIRST VERSION (correct_count / wrong_count)?
 *   Run these three lines in MySQL Workbench first, then this file:
 *     USE cognicare;
 *     ALTER TABLE game_sessions DROP CONSTRAINT chk_sessions_counts;
 *     ALTER TABLE game_sessions DROP COLUMN correct_count,
 *       DROP COLUMN wrong_count, DROP COLUMN avg_response_ms;
 *   (The columns were empty, so nothing is lost.)
 * ============================================================ */

USE cognicare;

ALTER TABLE game_sessions
  ADD COLUMN hit_count         SMALLINT UNSIGNED NULL AFTER score,
  ADD COLUMN miss_count        SMALLINT UNSIGNED NULL AFTER hit_count,
  ADD COLUMN false_alarm_count SMALLINT UNSIGNED NULL AFTER miss_count,
  ADD COLUMN reject_count      SMALLINT UNSIGNED NULL AFTER false_alarm_count,
  ADD COLUMN avg_response_ms   INT UNSIGNED      NULL AFTER reject_count,
  ADD CONSTRAINT chk_sessions_counts CHECK (
    (hit_count IS NULL AND miss_count IS NULL
       AND false_alarm_count IS NULL AND reject_count IS NULL)
    OR
    (hit_count IS NOT NULL AND miss_count IS NOT NULL
       AND false_alarm_count IS NOT NULL AND reject_count IS NOT NULL)
  );

/* The view gets the new columns, plus the rates calculated on the fly.
 * NULLIF avoids dividing by zero (e.g. a game with no match rounds).
 *   accuracy_pct     share of all answers that were correct
 *   hit_rate_pct     of the real matches, how many the player found
 *   false_alarm_pct  of the non-matches, how many the player wrongly
 *                    called a match                                    */
CREATE OR REPLACE VIEW v_session_details AS
SELECT s.session_id,
       s.user_id,
       g.game_name        AS game_type,
       l.level_label      AS difficulty_level,
       l.level_order,
       s.score,
       s.hit_count,
       s.miss_count,
       s.false_alarm_count,
       s.reject_count,
       ROUND(100 * (s.hit_count + s.reject_count)
             / NULLIF(s.hit_count + s.miss_count
                      + s.false_alarm_count + s.reject_count, 0))   AS accuracy_pct,
       ROUND(100 * s.hit_count
             / NULLIF(s.hit_count + s.miss_count, 0))               AS hit_rate_pct,
       ROUND(100 * s.false_alarm_count
             / NULLIF(s.false_alarm_count + s.reject_count, 0))     AS false_alarm_pct,
       s.avg_response_ms,
       s.duration_sec     AS duration,
       s.completed,
       s.played_at
FROM game_sessions s
JOIN difficulty_levels l ON l.level_id = s.level_id
JOIN game_types g        ON g.game_type_id = l.game_type_id;

/* Check: the new columns should be listed, old rows show NULL. */
DESCRIBE game_sessions;
SELECT session_id, game_type, difficulty_level, score,
       accuracy_pct, hit_rate_pct, false_alarm_pct, avg_response_ms
FROM v_session_details ORDER BY played_at DESC LIMIT 5;
