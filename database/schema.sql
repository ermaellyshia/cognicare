/* ============================================================
 * CogniCare - schema.sql
 * ------------------------------------------------------------
 * Relational database design (MySQL 8 / MariaDB 10.5+, e.g. XAMPP)
 * Meets the A251 guide: primary keys, foreign keys, 3NF, and data
 * integrity enforced BY THE DATABASE (not only by JavaScript).
 *
 * HOW TO RUN
 *   Terminal : mysql -u root -p < schema.sql
 *   Workbench: File > Open SQL Script > run all (lightning icon)
 *   phpMyAdmin: SQL tab > paste all > Go
 *              (if the trigger part complains, set the "Delimiter"
 *               box under the editor to $$ and run section 7 alone,
 *               or skip it - the tables work without the triggers)
 *   Running it again is safe: it only creates what is missing and
 *   re-inserts the seed rows with INSERT IGNORE.
 *
 * ENTITY-RELATIONSHIP DIAGRAM  (crow's foot: ||--o{ = one to many)
 *
 *   roles ||--o{ users                      a user has one role
 *   users ||--o{ caregiver_elderly (caregiver_id)
 *   users ||--o{ caregiver_elderly (elderly_id)
 *                         many caregivers <-> many elderly users
 *   users ||--o{ game_sessions              a user plays many sessions
 *   game_types ||--o{ difficulty_levels     N-Back: 1/2/3-back
 *                                           Match-3: 3x3/4x4/5x5
 *   difficulty_levels ||--o{ game_sessions  highest level reached
 *   users ||--o{ system_logs (admin_id)     admin actions (audit)
 *   users ||--o{ system_config (updated_by) last admin who changed it
 *
 * WHY THIS IS IN 3NF  (explain this in your report)
 *   1NF  every column holds one value. The old Firestore array
 *        "linkedUsers" becomes the table caregiver_elderly.
 *   2NF  every non-key column depends on the WHOLE key. Tables with
 *        a composite key (caregiver_elderly) only hold linked_at,
 *        which belongs to the pair.
 *   3NF  no column depends on another non-key column.
 *        - game_sessions stores only level_id. The game is found
 *          through difficulty_levels.game_type_id, so the game name
 *          is NOT repeated in every session row.
 *        - the role name lives in roles, not in users.
 *   Small fixed lists of values that are not entities (language,
 *   font size) use ENUM, so the database still rejects wrong values.
 *
 * MAPPING FROM THE OLD FIRESTORE DESIGN
 *   users (document)         -> users + roles + caregiver_elderly
 *   gameSessions (document)  -> game_sessions + game_types + difficulty_levels
 *   systemLogs (document)    -> system_logs
 *   systemConfig/main        -> system_config (one row)
 * ============================================================ */

CREATE DATABASE IF NOT EXISTS cognicare
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cognicare;

/* ------------------------------------------------------------
 * 1. LOOKUP TABLES  (small fixed lists)
 * ------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS roles (
  role_id    TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_name  VARCHAR(20)      NOT NULL,
  PRIMARY KEY (role_id),
  UNIQUE KEY uq_roles_name (role_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS game_types (
  game_type_id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  game_name    VARCHAR(30)      NOT NULL,          -- 'N-Back', 'Match-3'
  PRIMARY KEY (game_type_id),
  UNIQUE KEY uq_game_types_name (game_name)
) ENGINE=InnoDB;

/* One row per difficulty step of each game.
   level_label is exactly what the game code already produces:
   N-Back "1-back".."3-back", Match-3 "3x3".."5x5".
   level_order lets reports sort easy -> hard. */
CREATE TABLE IF NOT EXISTS difficulty_levels (
  level_id     SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  game_type_id TINYINT UNSIGNED  NOT NULL,
  level_label  VARCHAR(10)       NOT NULL,
  level_order  TINYINT UNSIGNED  NOT NULL,
  PRIMARY KEY (level_id),
  UNIQUE KEY uq_level_label (game_type_id, level_label),
  UNIQUE KEY uq_level_order (game_type_id, level_order),
  CONSTRAINT fk_levels_game
    FOREIGN KEY (game_type_id) REFERENCES game_types (game_type_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

/* ------------------------------------------------------------
 * 2. USERS
 *    password_hash holds a bcrypt hash made by the API.
 *    The plain password is NEVER stored.
 *    email uses a case-insensitive collation, so
 *    "Ali@mail.com" and "ali@mail.com" count as the same account.
 * ------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS users (
  user_id         INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  name            VARCHAR(100)     NOT NULL,
  email           VARCHAR(150)     NOT NULL,
  password_hash   VARCHAR(255)     NOT NULL,
  age             TINYINT UNSIGNED NOT NULL,
  role_id         TINYINT UNSIGNED NOT NULL,
  language_pref   ENUM('bm','en')  NOT NULL DEFAULT 'bm',
  font_size       ENUM('small','medium','large','extra-large')
                                   NOT NULL DEFAULT 'large',   -- seniors: large by default
  high_contrast   TINYINT(1)       NOT NULL DEFAULT 0,
  is_active       TINYINT(1)       NOT NULL DEFAULT 1,         -- admin can disable an account
  created_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles (role_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_users_age  CHECK (age BETWEEN 1 AND 120),
  CONSTRAINT chk_users_name CHECK (CHAR_LENGTH(TRIM(name)) > 0),
  CONSTRAINT chk_users_email CHECK (email LIKE '%_@_%._%')
) ENGINE=InnoDB;

/* ------------------------------------------------------------
 * 3. CAREGIVER <-> ELDERLY LINKS  (many-to-many)
 *    Replaces the Firestore array users.linkedUsers.
 *    Deleting either user removes the link automatically.
 * ------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS caregiver_elderly (
  caregiver_id INT UNSIGNED NOT NULL,
  elderly_id   INT UNSIGNED NOT NULL,
  linked_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (caregiver_id, elderly_id),
  KEY idx_link_elderly (elderly_id),
  CONSTRAINT fk_link_caregiver
    FOREIGN KEY (caregiver_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_link_elderly
    FOREIGN KEY (elderly_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
  -- A user linking to themselves is impossible: the triggers in section 7
  -- demand a caregiver on one side and an elderly user on the other.
  -- (MySQL does not allow a CHECK on columns that have cascading foreign keys.)
) ENGINE=InnoDB;

/* ------------------------------------------------------------
 * 4. GAME SESSIONS  (FR016)
 *    One row per finished (or ended-early) game.
 *    level_id = the HIGHEST level reached in that game.
 * ------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS game_sessions (
  session_id   BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED      NOT NULL,
  level_id     SMALLINT UNSIGNED NOT NULL,
  score        INT UNSIGNED      NOT NULL DEFAULT 0,
  duration_sec INT UNSIGNED      NOT NULL DEFAULT 0,
  completed    TINYINT(1)        NOT NULL DEFAULT 1,   -- 0 = player ended early
  played_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id),
  KEY idx_sessions_user_date (user_id, played_at),     -- progress charts per user
  KEY idx_sessions_level (level_id),
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sessions_level
    FOREIGN KEY (level_id) REFERENCES difficulty_levels (level_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_sessions_duration CHECK (duration_sec <= 86400)
) ENGINE=InnoDB;

/* ------------------------------------------------------------
 * 5. SYSTEM LOGS  (FR024)  - audit trail of admin actions
 *    admin_id becomes NULL (not deleted) if that admin account is
 *    removed, so the history is kept.
 * ------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS system_logs (
  log_id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id  INT UNSIGNED    NULL,
  action    VARCHAR(50)     NOT NULL,           -- e.g. DELETE_USER, UPDATE_CONFIG
  details   TEXT            NULL,
  logged_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_logs_time (logged_at),
  KEY idx_logs_admin (admin_id),
  CONSTRAINT fk_logs_admin
    FOREIGN KEY (admin_id) REFERENCES users (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

/* ------------------------------------------------------------
 * 6. SYSTEM CONFIGURATION  (FR023)
 *    Exactly ONE row (config_id is forced to 1). Each setting has
 *    its own typed column with a CHECK range, so the database
 *    rejects nonsense such as 0 rounds or a 60-second display time.
 *    Ranges match the limits the game code already applies.
 * ------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS system_config (
  config_id               TINYINT UNSIGNED  NOT NULL DEFAULT 1,
  nback_rounds_per_game   TINYINT UNSIGNED  NOT NULL DEFAULT 20,   -- rounds in one N-Back game
  nback_display_seconds   TINYINT UNSIGNED  NOT NULL DEFAULT 2,    -- seconds each number is shown
  nback_increase_streak   TINYINT UNSIGNED  NOT NULL DEFAULT 3,    -- correct in a row -> harder
  nback_decrease_streak   TINYINT UNSIGNED  NOT NULL DEFAULT 2,    -- wrong in a row -> easier
  match3_stuck_seconds    SMALLINT UNSIGNED NOT NULL DEFAULT 30,   -- seconds before hint / easier grid
  match3_increase_streak  TINYINT UNSIGNED  NOT NULL DEFAULT 3,    -- matches in a row -> bigger grid
  voice_enabled           TINYINT(1)        NOT NULL DEFAULT 1,
  maintenance_mode        TINYINT(1)        NOT NULL DEFAULT 0,    -- 1 = only admins may use the system
  updated_by              INT UNSIGNED      NULL,
  updated_at              DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (config_id),
  CONSTRAINT fk_config_admin
    FOREIGN KEY (updated_by) REFERENCES users (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_config_single_row CHECK (config_id = 1),
  CONSTRAINT chk_config_rounds     CHECK (nback_rounds_per_game BETWEEN 1 AND 60),
  CONSTRAINT chk_config_display    CHECK (nback_display_seconds BETWEEN 1 AND 6),
  CONSTRAINT chk_config_nb_up      CHECK (nback_increase_streak BETWEEN 1 AND 10),
  CONSTRAINT chk_config_nb_down    CHECK (nback_decrease_streak BETWEEN 1 AND 10),
  CONSTRAINT chk_config_stuck      CHECK (match3_stuck_seconds BETWEEN 5 AND 120),
  CONSTRAINT chk_config_m3_up      CHECK (match3_increase_streak BETWEEN 1 AND 10)
) ENGINE=InnoDB;

/* ------------------------------------------------------------
 * 7. TRIGGERS  (rules a CHECK cannot express because they look
 *    at ANOTHER table).
 *    Only a caregiver may be the caregiver_id of a link, and only
 *    an elderly user may be the elderly_id.
 * ------------------------------------------------------------ */

DROP TRIGGER IF EXISTS trg_link_roles_insert;
DROP TRIGGER IF EXISTS trg_link_roles_update;

DELIMITER $$

CREATE TRIGGER trg_link_roles_insert
BEFORE INSERT ON caregiver_elderly
FOR EACH ROW
BEGIN
  IF (SELECT r.role_name FROM users u JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = NEW.caregiver_id) <> 'caregiver' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'caregiver_id must belong to a caregiver';
  END IF;
  IF (SELECT r.role_name FROM users u JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = NEW.elderly_id) <> 'elderly' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'elderly_id must belong to an elderly user';
  END IF;
END$$

CREATE TRIGGER trg_link_roles_update
BEFORE UPDATE ON caregiver_elderly
FOR EACH ROW
BEGIN
  IF (SELECT r.role_name FROM users u JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = NEW.caregiver_id) <> 'caregiver' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'caregiver_id must belong to a caregiver';
  END IF;
  IF (SELECT r.role_name FROM users u JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = NEW.elderly_id) <> 'elderly' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'elderly_id must belong to an elderly user';
  END IF;
END$$

DELIMITER ;

/* ------------------------------------------------------------
 * 8. VIEW FOR THE DASHBOARD / REPORTS  (FR017, FR020, FR021)
 *    Joins the tables back together in the shape the old
 *    Firestore documents had (gameType, difficultyLevel, ...).
 *    The API can run:  SELECT * FROM v_session_details
 *                      WHERE user_id = ? ORDER BY played_at;
 * ------------------------------------------------------------ */

CREATE OR REPLACE VIEW v_session_details AS
SELECT s.session_id,
       s.user_id,
       g.game_name        AS game_type,
       l.level_label      AS difficulty_level,
       l.level_order,
       s.score,
       s.duration_sec     AS duration,
       s.completed,
       s.played_at
FROM game_sessions s
JOIN difficulty_levels l ON l.level_id = s.level_id
JOIN game_types g        ON g.game_type_id = l.game_type_id;

/* ------------------------------------------------------------
 * 9. SEED DATA  (needed before the system can run)
 *    INSERT IGNORE = safe to run again.
 *    No users are seeded: register the first accounts through the
 *    system. The first admin is promoted by hand (see below).
 * ------------------------------------------------------------ */

INSERT IGNORE INTO roles (role_id, role_name) VALUES
  (1, 'elderly'),
  (2, 'caregiver'),
  (3, 'admin');

INSERT IGNORE INTO game_types (game_type_id, game_name) VALUES
  (1, 'N-Back'),
  (2, 'Match-3');

INSERT IGNORE INTO difficulty_levels (level_id, game_type_id, level_label, level_order) VALUES
  (1, 1, '1-back', 1),
  (2, 1, '2-back', 2),
  (3, 1, '3-back', 3),
  (4, 2, '3x3', 1),
  (5, 2, '4x4', 2),
  (6, 2, '5x5', 3);

INSERT IGNORE INTO system_config (config_id) VALUES (1);   -- every column uses its default

/* ------------------------------------------------------------
 * AFTER YOU REGISTER YOUR FIRST ACCOUNT, make it an admin:
 *
 *   UPDATE users SET role_id = 3 WHERE email = 'your@email.com';
 *
 * (The registration form only offers elderly / caregiver, so
 *  nobody can make themselves admin from the website.)
 * ------------------------------------------------------------ */

/* ------------------------------------------------------------
 * QUICK CHECKS  (run these to confirm the design works)
 * ------------------------------------------------------------
 *  SHOW TABLES;                                  -- 8 tables + 1 view
 *  SELECT * FROM difficulty_levels;              -- 6 rows
 *  SELECT * FROM system_config;                  -- 1 row of defaults
 *
 *  -- these must FAIL (that is the point of the constraints):
 *  INSERT INTO system_config (config_id) VALUES (2);
 *  UPDATE system_config SET nback_display_seconds = 60;
 *  INSERT INTO game_sessions (user_id, level_id, score) VALUES (999, 1, 10);
 * ------------------------------------------------------------ */