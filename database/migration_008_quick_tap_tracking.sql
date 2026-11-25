-- Migration 008: "Quick Tap" becomes a bubble-tracking game.
-- Levels = how many bubbles to track out of how many in total.
-- Rows keep the same level_id, so any old sessions stay valid.

USE cognicare;

UPDATE difficulty_levels d
JOIN game_types g ON g.game_type_id = d.game_type_id
SET d.level_label = CASE d.level_order
  WHEN 1 THEN 'Track 2 of 5'
  WHEN 2 THEN 'Track 2 of 7'
  WHEN 3 THEN 'Track 3 of 8'
  WHEN 4 THEN 'Track 3 of 10'
  WHEN 5 THEN 'Track 4 of 12'
END
WHERE g.game_name = 'Quick Tap';

-- Check: should show 5 rows with the new labels
SELECT g.game_name, d.level_label, d.level_order
FROM game_types g
JOIN difficulty_levels d ON d.game_type_id = g.game_type_id
WHERE g.game_name = 'Quick Tap'
ORDER BY d.level_order;\