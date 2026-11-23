-- Increment 1: penafian wajib dan kategori fokus
ALTER TABLE users
  ADD COLUMN disclaimer_accepted_at DATETIME NULL,
  ADD COLUMN focus_area ENUM('memory','attention','speed') NULL;