/**
 * ============================================================
 * CogniCare - server/db.js
 * ------------------------------------------------------------
 * DATABASE LAYER (the bottom layer of the system).
 *
 *   Browser (HTML/JS)  ->  API routes (Express)  ->  db.js  ->  MySQL
 *
 * Nothing else in the server talks to MySQL directly. Every other
 * file imports the helpers from here. This keeps the layers
 * separate (A251: "struktur sistem berlapis").
 *
 * WHAT IT GIVES YOU
 *   query(sql, params)        run SQL, get an ARRAY of rows
 *   queryOne(sql, params)     run SQL, get ONE row (or null)
 *   execute(sql, params)      INSERT / UPDATE / DELETE, get
 *                             { insertId, affectedRows }
 *   withTransaction(fn)       run several statements as one unit:
 *                             all succeed, or none are saved
 *   friendlyDbError(err)      turn a MySQL error into
 *                             { status, message } for the API
 *   checkConnection()         quick health check
 *   closePool()               close all connections (shutdown)
 *
 * SECURITY: always pass user values in the `params` array and use
 * ? in the SQL. Never build SQL by joining strings with user text.
 *   RIGHT:  query("SELECT * FROM users WHERE email = ?", [email])
 *   WRONG:  query("SELECT * FROM users WHERE email = '" + email + "'")
 * The ? version cannot be hijacked by SQL injection.
 *
 * TEST IT:   node db.js      (prints the connection result)
 * ============================================================
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

// Load server/.env no matter which folder the command is run from.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, ".env") });

// ------------------------------------------------------------
// 1. SETTINGS (from .env)
// ------------------------------------------------------------
const config = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME || "cognicare",
};

if (!process.env.DB_PASSWORD) {
  console.warn("[db] DB_PASSWORD is empty in .env. This only works if your MySQL user has no password.");
}

// ------------------------------------------------------------
// 2. CONNECTION POOL
//    A pool keeps a few connections open and shares them between
//    requests (faster than opening a new one every time).
// ------------------------------------------------------------
export const pool = mysql.createPool({
  ...config,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  timezone: "+00:00", // JavaScript dates are read and written as UTC
});

// Make MySQL itself use UTC too, so CURRENT_TIMESTAMP columns
// (created_at, played_at, ...) are UTC. The browser converts to
// the user's local time when it shows them.
pool.pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

// ------------------------------------------------------------
// 3. QUERY HELPERS
// ------------------------------------------------------------

/** Run a SELECT. Returns an array of rows (empty array if none). */
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** Run a SELECT that should give at most one row. Returns the row or null. */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Run an INSERT / UPDATE / DELETE.
 * @returns {Promise<{insertId:number, affectedRows:number}>}
 *   insertId     = the new AUTO_INCREMENT id (INSERT only)
 *   affectedRows = how many rows changed (0 = nothing matched)
 */
export async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return { insertId: result.insertId, affectedRows: result.affectedRows };
}

/**
 * Run several statements as ONE unit (a transaction).
 * If anything inside throws, everything is rolled back.
 *
 *   await withTransaction(async (tx) => {
 *     await tx.execute("DELETE FROM users WHERE user_id = ?", [id]);
 *     await tx.execute("INSERT INTO system_logs (...) VALUES (...)", [...]);
 *   });
 *
 * `tx` has the same query / queryOne / execute helpers as above,
 * but they all use the same connection.
 */
export async function withTransaction(work) {
  const connection = await pool.getConnection();
  const tx = {
    async query(sql, params = []) {
      const [rows] = await connection.execute(sql, params);
      return rows;
    },
    async queryOne(sql, params = []) {
      const rows = await tx.query(sql, params);
      return rows.length > 0 ? rows[0] : null;
    },
    async execute(sql, params = []) {
      const [result] = await connection.execute(sql, params);
      return { insertId: result.insertId, affectedRows: result.affectedRows };
    },
  };

  try {
    await connection.beginTransaction();
    const result = await work(tx);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release(); // ALWAYS give the connection back to the pool
  }
}

// ------------------------------------------------------------
// 4. ERRORS  (database error -> message for the API)
//    This is where the database constraints from schema.sql
//    show up as clear messages for the user.
// ------------------------------------------------------------

/**
 * @param {Error & {code?:string, errno?:number, sqlState?:string, sqlMessage?:string}} err
 * @returns {{status:number, message:string}}
 *   status  = HTTP status code to send
 *   message = safe text for the user (never the raw SQL error)
 */
export function friendlyDbError(err) {
  switch (err?.errno) {
    case 1062: // duplicate value in a UNIQUE column
      if (/uq_users_email/.test(err.sqlMessage || "")) {
        return { status: 409, message: "This email is already registered." };
      }
      return { status: 409, message: "This record already exists." };
    case 1452: // foreign key: the referenced row does not exist
      return { status: 400, message: "A related record was not found." };
    case 1451: // foreign key: other rows still depend on this one
      return { status: 409, message: "This record is still in use and cannot be removed." };
    case 3819: // CHECK constraint failed
      return { status: 400, message: "A value is outside the allowed range." };
    case 1265: // value does not fit the column (e.g. wrong ENUM value)
    case 1366:
    case 1264:
      return { status: 400, message: "A value is not valid." };
    case 1644: // our own trigger said no (SIGNAL SQLSTATE '45000')
      return { status: 400, message: err.sqlMessage || "This action is not allowed." };
    default:
      // Unknown: keep the details in the server log only.
      console.error("[db] Unexpected database error:", err);
      return { status: 500, message: "Database error. Please try again." };
  }
}

// ------------------------------------------------------------
// 5. HEALTH CHECK + SHUTDOWN
// ------------------------------------------------------------

/**
 * Confirms MySQL answers and the CogniCare tables exist.
 * @returns {Promise<{ok:boolean, tables:number, error?:string}>}
 */
export async function checkConnection() {
  try {
    const row = await queryOne(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ?",
      [config.database]
    );
    return { ok: true, tables: Number(row.total) };
  } catch (err) {
    return { ok: false, tables: 0, error: err.message };
  }
}

/** Close every connection (call when the server stops). */
export async function closePool() {
  await pool.end();
}

// ------------------------------------------------------------
// 6. SELF-TEST:  node db.js
// ------------------------------------------------------------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await checkConnection();
  if (result.ok) {
    console.log(`Connected to MySQL "${config.database}" on ${config.host}:${config.port}`);
    console.log(`Tables and views found: ${result.tables} (expected 9)`);
    const roles = await query("SELECT role_id, role_name FROM roles ORDER BY role_id");
    console.log("Roles:", roles.map((r) => r.role_name).join(", "));
  } else {
    console.error("Could not connect:", result.error);
    console.error("Check DB_PASSWORD and DB_NAME in server/.env, and that MySQL is running:");
    console.error("  brew services list");
    process.exitCode = 1;
  }
  await closePool();
}