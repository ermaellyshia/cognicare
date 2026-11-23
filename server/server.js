/**
 * ============================================================
 * CogniCare - server/server.js
 * ------------------------------------------------------------
 * The API server (middle layer of the system).
 *
 *   Browser (HTML/JS)  ->  server.js + routes  ->  db.js  ->  MySQL
 *
 * THIS FILE: starts Express, sets the common rules (JSON, CORS,
 * error handling) and mounts the routes. The real features live
 * in separate route files that are added one at a time:
 *
 *   routes/auth.js      register, login, me              (next)
 *   routes/me.js        disclaimer consent, focus area   (Increment 1)
 *   routes/users.js     profile, settings, caregiver links
 *   routes/sessions.js  save and read game sessions
 *   routes/admin.js     users list, logs, config, performance
 *
 * START IT
 *   cd server
 *   npm run dev       restarts by itself when you save a file
 *   npm start         normal start
 *
 * TEST IT (server running) - open in the browser:
 *   http://localhost:3000/api/health
 * ============================================================
 */

// db.js loads server/.env first, so it must be imported before
// anything reads process.env.
import { checkConnection, closePool } from "./db.js";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import sessionRoutes from "./routes/sessions.js";
import meRoutes from "./routes/me.js";

// ------------------------------------------------------------
// 1. SETTINGS
// ------------------------------------------------------------
const PORT = Number(process.env.PORT) || 3000;

// Pages are opened from Live Server (http://127.0.0.1:5500), a
// different "origin" than this API, so the browser needs CORS
// permission. FRONTEND_ORIGIN can list several, separated by commas.
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5500")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const secret = process.env.JWT_SECRET || "";
if (secret.length < 32 || secret.startsWith("GANTI")) {
  console.warn("[server] JWT_SECRET in .env is missing or too short. Login will need it (next step).");
}

// ------------------------------------------------------------
// 2. EXPRESS APP + COMMON RULES (middleware)
// ------------------------------------------------------------
const app = express();
app.disable("x-powered-by");            // do not advertise "Express" to everyone
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "100kb" })); // read JSON bodies, refuse huge ones

// One line per request in the Terminal, handy while developing.
app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started} ms)`);
  });
  next();
});

// ------------------------------------------------------------
// 3. ROUTES
// ------------------------------------------------------------

/** Health check: is the API up, and does it reach MySQL? (FR022 uses a version of this) */
app.get("/api/health", async (req, res) => {
  const started = Date.now();
  const db = await checkConnection();
  res.status(db.ok ? 200 : 503).json({
    status: db.ok ? "ok" : "database unavailable",
    database: db.ok ? "connected" : "not connected",
    tables: db.tables,
    responseMs: Date.now() - started,
    time: new Date().toISOString(),
  });
});

// Feature routes (more are added in later steps)
app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/me", meRoutes);

// ------------------------------------------------------------
// 4. ERRORS  (must stay AFTER the routes)
// ------------------------------------------------------------

// Any /api address that does not exist
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found." });
});

// Anything that throws inside a route ends up here
// (4 parameters = Express knows this is the error handler)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Body is not valid JSON
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON." });
  }
  // Body too large
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }
  console.error("[server] Unexpected error:", err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

// ------------------------------------------------------------
// 5. START + SHUT DOWN CLEANLY
// ------------------------------------------------------------
const server = app.listen(PORT, async () => {
  console.log(`CogniCare API running at http://localhost:${PORT}`);
  console.log(`Allowed website origins: ${allowedOrigins.join(", ")}`);
  const db = await checkConnection();
  console.log(db.ok ? `MySQL connected (${db.tables} tables/views)` : `MySQL NOT connected: ${db.error}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other server (Ctrl + C in its Terminal) or change PORT in .env.`);
  } else {
    console.error("[server] Could not start:", err);
  }
  process.exit(1);
});

// Ctrl + C in the Terminal: finish open requests, close MySQL, exit.
async function shutdown() {
  console.log("\nStopping server...");
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);