/**
 * ============================================================
 * CogniCare - server/services/linkService.js
 * ------------------------------------------------------------
 * SERVICE LAYER for caregiver <-> elderly links.
 * The only place that knows the SQL for the `caregiver_elderly`
 * table (many caregivers <-> many elderly users).
 *
 *   isLinked(caregiverId, elderlyId)     true / false
 *   getLinkedUsers(caregiverId)          [ public user, ... ]
 *   linkByEmail(caregiverId, email)      link, returns the elderly user
 *   unlink(caregiverId, elderlyId)       remove the link
 *
 * Business rules are checked here (clear messages); the database
 * triggers and foreign keys in schema.sql are the safety net.
 * Errors we raise ourselves carry a `status` (400 / 404 / 409).
 * ============================================================
 */

import { query, queryOne, execute } from "../db.js";
import { toPublicUser } from "./userService.js";

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

/** Is this elderly user linked to this caregiver? */
export async function isLinked(caregiverId, elderlyId) {
  const row = await queryOne(
    "SELECT 1 AS ok FROM caregiver_elderly WHERE caregiver_id = ? AND elderly_id = ?",
    [caregiverId, elderlyId]
  );
  return row !== null;
}

/** The elderly users linked to a caregiver (oldest link first). */
export async function getLinkedUsers(caregiverId) {
  const rows = await query(
    `SELECT u.user_id, u.name, u.email, u.age, r.role_name,
            u.language_pref, u.font_size, u.high_contrast,
            u.is_active, u.created_at
     FROM caregiver_elderly ce
     JOIN users u ON u.user_id = ce.elderly_id
     JOIN roles r ON r.role_id = u.role_id
     WHERE ce.caregiver_id = ?
     ORDER BY ce.linked_at, u.user_id`,
    [caregiverId]
  );
  return rows.map(toPublicUser);
}

/** Link an elderly user (found by e-mail) to a caregiver. */
export async function linkByEmail(caregiverId, email) {
  const row = await queryOne(
    `SELECT u.user_id, u.name, u.email, u.age, r.role_name,
            u.language_pref, u.font_size, u.high_contrast,
            u.is_active, u.created_at
     FROM users u JOIN roles r ON r.role_id = u.role_id
     WHERE u.email = ?`,
    [email]
  );
  // Same wording for "no such user" and "wrong role": do not reveal
  // which e-mails exist as caregivers/admins.
  if (!row || row.role_name !== "elderly" || !row.is_active) {
    throw httpError(404, "No elderly user was found with this e-mail.");
  }
  if (await isLinked(caregiverId, row.user_id)) {
    throw httpError(409, "This user is already linked to you.");
  }
  await execute(
    "INSERT INTO caregiver_elderly (caregiver_id, elderly_id) VALUES (?, ?)",
    [caregiverId, row.user_id]
  );
  return toPublicUser(row);
}

/** Remove a link. Throws 404 if there was none. */
export async function unlink(caregiverId, elderlyId) {
  const result = await execute(
    "DELETE FROM caregiver_elderly WHERE caregiver_id = ? AND elderly_id = ?",
    [caregiverId, elderlyId]
  );
  if (result.affectedRows === 0) throw httpError(404, "This link does not exist.");
}