/* ============================================================
 * CogniCare - database/migration_004_card_pairs.sql
 * ------------------------------------------------------------
 * WHY THIS FILE EXISTS
 *   Increment 1 adds three new games (one per category). This
 *   migration adds the FIRST one: Card Pairs (Memory), and the
 *   two numbers every new game reports:
 *     attempt_count   how many times the player tried
 *                     (Card Pairs: pairs of cards turned over)
 *     correct_count   how many of those attempts were correct
 *   accuracy = correct / attempts, calculated in the view
 *   (not stored: a stored copy would break 3NF).
 *
 *   N-Back keeps its own four counts. Both kinds of game use the
 *   same view column accuracy_pct, so the AI reads one number.
 *
 * LEVELS of Card Pairs: 4, 6, 8, 12 and 16 cards.
 *
 * HOW TO RUN (once only):
 *     cd /Users/ermaellyshia/Documents/cognicare/database
 *     mysql -u root -p < migration_004_card_pairs.sql
 * ============================================================ */

USE cognicare;

/* 1. The game and its five levels (looked up by name, so no ids are typed by hand) */
INSERT INTO game_types (game_name) VALUES ('Card Pairs');

INSERT INTO difficulty_levels (game_type_id, level_label, level_order)
SELECT g.game_type_id, v.level_label, v.level_order
FROM game_types g
JOIN (
  SELECT '4 cards'  AS level_label, 1 AS level_order
  UNION ALL SELECT '6 cards',  2
  UNION ALL SELECT '8 cards',  3
  UNION ALL SELECT '12 cards', 4
  UNION ALL SELECT '16 cards', 5
) v
WHERE g.game_name = 'Card Pairs';

/* 2. The two generic counts (NULL for old games and for N-Back) */
ALTER TABLE game_sessions
  ADD COLUMN attempt_count SMALLINT UNSIGNED NULL AFTER avg_response_ms,
  ADD COLUMN correct_count SMALLINT UNSIGNED NULL AFTER attempt_count,
  ADD CONSTRAINT chk_sessions_attempts CHECK (
    (attempt_count IS NULL AND correct_count IS NULL)
    OR
    (attempt_count IS NOT NULL AND correct_count IS NOT NULL
       AND correct_count <= attempt_count)
  );

/* 3. The view: accuracy_pct now works for both kinds of game.
 *    New games: correct / attempts.   N-Back: the four-count formula. */
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
       s.attempt_count,
       s.correct_count,
       COALESCE(
         ROUND(100 * s.correct_count / NULLIF(s.attempt_count, 0)),
         ROUND(100 * (s.hit_count + s.reject_count)
               / NULLIF(s.hit_count + s.miss_count
                        + s.false_alarm_count + s.reject_count, 0))
       )                                                            AS accuracy_pct,
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

/* Check: Card Pairs and its five levels should be listed. */
SELECT g.game_name, l.level_label, l.level_order
FROM game_types g
JOIN difficulty_levels l ON l.game_type_id = g.game_type_id
WHERE g.game_name = 'Card Pairs'
ORDER BY l.level_order;