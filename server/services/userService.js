/**
 * ============================================================
 * CogniCare - server/services/userService.js
 * ------------------------------------------------------------
 * SERVICE LAYER for users: the only place that knows the SQL for
 * the `users` table.
 *
 *   routes (HTTP)  ->  services (business logic + SQL)  ->  db.js
 *
 * The routes never write SQL. They call the functions below and
 * get plain JavaScript objects back.
 *
 * SHAPE OF A USER OBJECT (same names the website already uses,
 * so the pages need very few changes):
 *   { userId, name, email, age, role, languagePreference,
 *     fontSize, highContrastMode, isActive, createdAt }
 * The password hash is NEVER part of it.
 * ============================================================
 */

import { query, queryOne, execute } from "../db.js";

// One SELECT used everywhere, so every function returns the same columns.
// The JOIN turns role_id (a number) into the role name ("elderly", ...).
const USER_SELECT = `
  SELECT u.user_id, u.name, u.email, u.age, r.role_name,
         u.language_pref, u.font_size, u.high_contrast,
         u.is_active, u.created_at
  FROM users u
  JOIN roles r ON r.role_id = u.role_id`;

/** Database row -> object for the website (no password hash). */
export function toPublicUser(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    age: row.age,
    role: row.role_name,
    languagePreference: row.language_pref,
    fontSize: row.font_size,
    highContrastMode: Boolean(row.high_contrast),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

/** Find a user by id. Returns the public object, or null. */
export async function getUserById(userId) {
  const row = await queryOne(`${USER_SELECT} WHERE u.user_id = ?`, [userId]);
  return toPublicUser(row);
}

/**
 * For LOGIN only: find a user by email and include the password hash.
 * Returns { user, passwordHash } or null.
 * (Email matching ignores upper/lower case: the column collation does that.)
 */
export async function findForLogin(email) {
  const row = await queryOne(
    `SELECT u.password_hash, u.user_id, u.name, u.email, u.age, r.role_name,
            u.language_pref, u.font_size, u.high_contrast, u.is_active, u.created_at
     FROM users u
     JOIN roles r ON r.role_id = u.role_id
     WHERE u.email = ?`,
    [email]
  );
  if (!row) return null;
  return { user: toPublicUser(row), passwordHash: row.password_hash };
}

/**
 * Create an account. The password must ALREADY be hashed (bcrypt)
 * by the caller. The role is given by name; the database turns it
 * into role_id. Throws the MySQL error if the email already exists
 * (db.js friendlyDbError explains it to the user).
 * @returns the new user (public object)
 */
export async function createUser({ name, email, passwordHash, age, role, languagePreference = "bm" }) {
  const result = await execute(
    `INSERT INTO users (name, email, password_hash, age, role_id, language_pref)
     VALUES (?, ?, ?, ?, (SELECT role_id FROM roles WHERE role_name = ?), ?)`,
    [name, email, passwordHash, age, role, languagePreference]
  );
  return getUserById(result.insertId);
}

/** How many users exist (used to check the first admin, reports, ...). */
export async function countUsers() {
  const rows = await query("SELECT COUNT(*) AS total FROM users");
  return Number(rows[0].total);
}