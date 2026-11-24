-- Migration 006: "Find the Target" becomes a Stroop-style game.
-- Levels 1-3: answer the INK colour of a colour word.
-- Levels 4-5: answer the BORDER colour of a shape (ignore the word inside).
-- Rows keep the same level_id, so any old sessions stay valid.

USE cognicare;

-- The new labels are longer than 10 characters, so widen the column.
ALTER TABLE difficulty_levels
  MODIFY COLUMN level_label VARCHAR(30) NOT NULL;

UPDATE difficulty_levels d
JOIN game_types g ON g.game_type_id = d.game_type_id
SET d.level_label = CASE d.level_order
  WHEN 1 THEN '3 colours easy'
  WHEN 2 THEN '3 colours mixed'
  WHEN 3 THEN '4 colours hard'
  WHEN 4 THEN 'Shape 4 colours'
  WHEN 5 THEN 'Shape 5 colours hard'
END
WHERE g.game_name = 'Find the Target';

-- Check: should show 5 rows with the new labels
SELECT g.game_name, d.level_label, d.level_order
FROM game_types g
JOIN difficulty_levels d ON d.game_type_id = g.game_type_id
WHERE g.game_name = 'Find the Target'
ORDER BY d.level_order;