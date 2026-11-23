-- Increment 1: "not sure" is remembered as its own value
ALTER TABLE users
  MODIFY COLUMN focus_area ENUM('memory','attention','speed','unsure') NULL;