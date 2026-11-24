-- Migration 005: add the game "Find the Target" (Attention) with 5 levels.
-- Levels = number of symbols on the screen (4, 6, 9, 12, 16).

USE cognicare;

INSERT INTO game_types (game_name) VALUES ('Find the Target');

INSERT INTO difficulty_levels (game_type_id, level_label, level_order)
SELECT g.game_type_id, v.label, v.ord
FROM game_types g
JOIN (
  SELECT '4 items'  AS label, 1 AS ord
  UNION ALL SELECT '6 items',  2
  UNION ALL SELECT '9 items',  3
  UNION ALL SELECT '12 items', 4
  UNION ALL SELECT '16 items', 5
) v
WHERE g.game_name = 'Find the Target';

-- Check: should show 5 rows
SELECT g.game_name, d.level_label, d.level_order
FROM game_types g
JOIN difficulty_levels d ON d.game_type_id = g.game_type_id
WHERE g.game_name = 'Find the Target'
ORDER BY d.level_order;