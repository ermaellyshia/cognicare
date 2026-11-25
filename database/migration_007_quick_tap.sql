-- Migration 007: add the game "Quick Tap" (Brain Speed) with 5 levels.
-- Levels = number of circles on the screen (2, 3, 4, 6, 9).

USE cognicare;

INSERT INTO game_types (game_name) VALUES ('Quick Tap');

INSERT INTO difficulty_levels (game_type_id, level_label, level_order)
SELECT g.game_type_id, v.label, v.ord
FROM game_types g
JOIN (
  SELECT '2 circles' AS label, 1 AS ord
  UNION ALL SELECT '3 circles', 2
  UNION ALL SELECT '4 circles', 3
  UNION ALL SELECT '6 circles', 4
  UNION ALL SELECT '9 circles', 5
) v
WHERE g.game_name = 'Quick Tap';

-- Check: should show 5 rows
SELECT g.game_name, d.level_label, d.level_order
FROM game_types g
JOIN difficulty_levels d ON d.game_type_id = g.game_type_id
WHERE g.game_name = 'Quick Tap'
ORDER BY d.level_order;