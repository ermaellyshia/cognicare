/**
 * ============================================================
 * CogniCare - js/firebase-config.js   (NOW THE MySQL API CLIENT)
 * ------------------------------------------------------------
 * This file used to talk to Firebase. It now talks to the CogniCare
 * API (server/ folder), which stores everything in MySQL:
 *
 *   this file  ->  http://localhost:3000/api/...  ->  MySQL
 *
 * THE FILE NAME IS KEPT ON PURPOSE. Every other file (auth.js,
 * game-nback.js, ai-difficulty.js, settings.html) imports from
 * "./firebase-config.js" and uses the SAME function names as before,
 * so none of them had to be changed. Rename it later if you like
 * (then change the 4 import lines).
 *
 * Keep the old Firebase version as a backup under the name
 * firebase-config.OLD.js
 *
 * HOW LOGIN WORKS HERE
 *  - login / register  -> the API returns a TOKEN. It is saved in the
 *    browser (localStorage) and sent with every request:
 *       Authorization: Bearer <token>
 *  - logout            -> the token is deleted.
 *  - errors            -> thrown with Firebase-style codes
 *    ("auth/email-already-in-use", ...) so friendlyAuthError() and
 *    auth.js work exactly as before.
 *
 * WHICH API ADDRESS IS USED
 *  Same computer, port 3000:  http://<same host as the page>:3000/api
 *  To use another address, set before the scripts load:
 *     <script>window.COGNICARE_API_URL = "https://my-server/api";</script>
 *
 * FEATURES AND THEIR API ROUTES
 *   login / register / me          /api/auth/...        (ready)
 *   acceptDisclaimer, setFocusArea /api/me/...          (Increment 1, ready)
 *   saveGameSession, getUserSessions, getAllSessions,
 *   getPlayStreak                  /api/sessions/...    (next step)
 *   getSystemConfig                /api/config          (falls back to
 *                                  defaults until it exists)
 *   updateUserProfile, links       /api/users/...       (next step)
 * ============================================================
 */

// ------------------------------------------------------------
// 1. SETTINGS
// ------------------------------------------------------------
function findApiBase() {
  if (typeof window !== "undefined" && window.COGNICARE_API_URL) return window.COGNICARE_API_URL;
  const loc = typeof location !== "undefined" ? location : null;
  if (!loc || loc.protocol === "file:" || !loc.hostname) return "http://localhost:3000/api";
  return `${loc.protocol}//${loc.hostname}:3000/api`;
}
const API_BASE = findApiBase();

const TOKEN_KEY = "cognicare_token";

const VALID_LANGS = ["bm", "en"];
const VALID_FONT_SIZES = ["small", "medium", "large", "extra-large"];

// ------------------------------------------------------------
// 2. TOKEN STORAGE  (localStorage, with a memory fallback)
// ------------------------------------------------------------
let memoryToken = null;
let cachedProfile = null; // the logged-in user, kept while the page is open
let cachedForToken = null; // the token that profile belongs to

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || memoryToken;
  } catch (err) {
    return memoryToken;
  }
}
function saveToken(token) {
  memoryToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (err) {
    /* storage blocked: the memory copy still works for this page */
  }
}
function clearToken() {
  memoryToken = null;
  cachedProfile = null;
  cachedForToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    /* ignore */
  }
}

// ------------------------------------------------------------
// 3. HELPERS
// ------------------------------------------------------------

/** Convert a date-like value (ISO text from the API, Date) to a Date. */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// The API answers errors with { error, key }. These keys become the
// Firebase-style codes that auth.js already understands.
const KEY_TO_CODE = {
  errWrongLogin: "auth/invalid-credential",
  errEmailUsed: "auth/email-already-in-use",
  errWeakPassword: "auth/weak-password",
  errInvalidEmail: "auth/invalid-email",
  errTooMany: "auth/too-many-requests",
};

/**
 * Turn an error into a short message KEY (see translations.js) so the
 * text follows the chosen language. Same function name as before.
 */
export function friendlyAuthError(error) {
  const map = {
    "auth/invalid-email": { key: "errInvalidEmail", en: "That email address does not look right." },
    "auth/user-not-found": { key: "errWrongLogin", en: "Email or password is incorrect." },
    "auth/wrong-password": { key: "errWrongLogin", en: "Email or password is incorrect." },
    "auth/invalid-credential": { key: "errWrongLogin", en: "Email or password is incorrect." },
    "auth/email-already-in-use": { key: "errEmailUsed", en: "This email is already registered." },
    "auth/weak-password": { key: "errWeakPassword", en: "Password must be at least 6 characters." },
    "auth/too-many-requests": { key: "errTooMany", en: "Too many tries. Please wait and try again." },
    "auth/network-request-failed": { key: "errNetwork", en: "No internet connection." },
  };
  return map[error?.code] || { key: "errGeneric", en: "Something went wrong. Please try again." };
}

/**
 * Call the API.
 * @param {string} path     e.g. "/auth/login"
 * @param {{method?:string, body?:object, auth?:boolean}} [options]
 * @returns parsed JSON (or null when the answer has no body)
 */
async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // The server is off, or the network is down.
    throw Object.assign(new Error("Cannot reach the server."), { code: "auth/network-request-failed" });
  }

  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    /* answer had no JSON body */
  }

  if (!response.ok) {
    // An expired or rejected token: forget it, the user must log in again.
    if (response.status === 401 && auth) clearToken();
    throw Object.assign(new Error(data?.error || `Request failed (${response.status}).`), {
      code: KEY_TO_CODE[data?.key] || "api/error",
      key: data?.key,
      status: response.status,
    });
  }
  return data;
}

// ------------------------------------------------------------
// 4. AUTHENTICATION  (FR001, FR002)
// ------------------------------------------------------------

/** Create an account. Returns the new user's profile (and logs in). */
export async function registerUser(data) {
  const result = await request("/auth/register", {
    method: "POST",
    auth: false,
    body: {
      name: data.name,
      email: data.email,
      age: data.age,
      password: data.password,
      role: data.role,
      languagePreference: data.languagePreference || "bm",
    },
  });
  saveToken(result.token);
  cachedProfile = result.user;
  cachedForToken = result.token;
  return result.user;
}

/** Log in. Returns the user's profile. */
export async function loginUser(email, password) {
  const result = await request("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
  saveToken(result.token);
  cachedProfile = result.user;
  cachedForToken = result.token;
  return result.user;
}

/** Log out (the token only lives in the browser, so just forget it). */
export async function logoutUser() {
  clearToken();
}

/**
 * FR005 - NOT available yet. Firebase sent the reset e-mail itself; with
 * MySQL we would need our own e-mail service. The login page shows the
 * normal "something went wrong" message if someone presses it.
 */
export async function resetPassword() {
  throw Object.assign(new Error("Password reset by e-mail is not available yet."), {
    code: "auth/operation-not-allowed",
  });
}

/**
 * Resolve with the logged-in user's profile, or null when nobody is
 * logged in (or the session has expired). Used by every page guard.
 */
export async function getCurrentUserProfile() {
  const token = getToken();
  if (!token) return null;
  // Use the saved copy only if it belongs to the token that is stored now
  // (another tab may have logged out or logged in as someone else).
  if (cachedProfile && cachedForToken === token) return cachedProfile;
  try {
    const result = await request("/auth/me");
    cachedProfile = result.user;
    cachedForToken = token;
    return cachedProfile;
  } catch (err) {
    if (err.code !== "auth/network-request-failed") console.warn("Not logged in:", err.message);
    return null;
  }
}

/**
 * Same idea as the old Firebase listener: calls back ONCE with the
 * current profile (or null). Returns an "unsubscribe" function.
 */
export function onAuthChange(callback) {
  let active = true;
  getCurrentUserProfile().then((profile) => {
    if (active) callback(profile);
  });
  return () => {
    active = false;
  };
}

// ------------------------------------------------------------
// 4b. INCREMENT 1: disclaimer + focus area   - route: /api/me
// ------------------------------------------------------------

/** The user accepts the disclaimer. Returns the updated profile. */
export async function acceptDisclaimer() {
  const result = await request("/me/consent", { method: "PUT" });
  cachedProfile = result.user; // so the page guards see the new state at once
  cachedForToken = getToken();
  return result.user;
}

/**
 * Save the starting category.
 * @param {"memory"|"attention"|"speed"|null} focusArea  null = "not sure"
 */
export async function setFocusArea(focusArea) {
  const result = await request("/me/focus", { method: "PUT", body: { focusArea } });
  cachedProfile = result.user;
  cachedForToken = getToken();
  return result.user;
}

/**
 * Where should the user go right after login / register?
 *   "disclaimer"  has not accepted the disclaimer yet (mandatory)
 *   "focus"       accepted, but has not chosen a category yet
 *   "home"        ready
 * Note: "not sure" is saved as focusArea = null, so the category page
 * is shown again next time. If you want "not sure" to be remembered,
 * we can store it as a fourth value later.
 */
export function nextStepAfterLogin(user) {
  if (!user?.disclaimerAcceptedAt) return "disclaimer";
  if (user.role === "elderly" && !user.focusArea) return "focus"; // only elderly choose a category
  return "home";
}

// ------------------------------------------------------------
// 5. USERS / PROFILE  (FR004, FR008-FR010)   - route: /api/users
// ------------------------------------------------------------

/** Read a profile. (Only your own profile for now.) */
export async function getUserProfile(userId) {
  const me = await getCurrentUserProfile();
  if (me && String(me.userId) === String(userId)) return me;
  const result = await request(`/users/${encodeURIComponent(userId)}`);
  return result.user;
}

/** Change name, age, language, font size or contrast. */
export async function updateUserProfile(userId, changes) {
  const allowed = {};
  if (changes.name !== undefined) {
    if (!String(changes.name).trim()) throw new Error("Name cannot be empty.");
    allowed.name = String(changes.name).trim();
  }
  if (changes.age !== undefined) {
    if (!(Number(changes.age) > 0)) throw new Error("Invalid age.");
    allowed.age = Number(changes.age);
  }
  if (changes.languagePreference !== undefined) {
    if (!VALID_LANGS.includes(changes.languagePreference)) throw new Error("Invalid language.");
    allowed.languagePreference = changes.languagePreference;
  }
  if (changes.fontSize !== undefined) {
    if (!VALID_FONT_SIZES.includes(changes.fontSize)) throw new Error("Invalid font size.");
    allowed.fontSize = changes.fontSize;
  }
  if (changes.highContrastMode !== undefined) {
    allowed.highContrastMode = Boolean(changes.highContrastMode);
  }
  if (Object.keys(allowed).length === 0) throw new Error("Nothing to update.");

  const result = await request("/users/me", { method: "PATCH", body: allowed });
  cachedProfile = result.user || { ...cachedProfile, ...allowed };
  return allowed;
}

/** Caregiver: link an elderly user by e-mail. Returns that elderly user. */
export async function linkElderlyUser(caregiverId, elderlyEmail) {
  const result = await request("/users/links", { method: "POST", body: { email: elderlyEmail } });
  return result.user;
}

/** Caregiver: remove a link. */
export async function unlinkElderlyUser(caregiverId, elderlyUserId) {
  await request(`/users/links/${encodeURIComponent(elderlyUserId)}`, { method: "DELETE" });
}

/** Caregiver: the elderly users linked to this caregiver. */
export async function getLinkedUsers(caregiverId) {
  const result = await request("/users/links");
  return result.users;
}

// ------------------------------------------------------------
// 6. GAME SESSIONS  (FR016-FR021)   - route: /api/sessions
// ------------------------------------------------------------

/**
 * FR016 - Save a finished game.
 * result = { gameType, score, difficultyLevel, duration, completed }
 *   N-Back  -> difficultyLevel "2-back"      Match-3 -> "4x4"
 */
export async function saveGameSession(userId, result) {
  const response = await request("/sessions", {
    method: "POST",
    body: {
      gameType: result.gameType,
      score: result.score,
      difficultyLevel: String(result.difficultyLevel),
      duration: Math.round(result.duration || 0),
      completed: result.completed !== false,
      // AI data (N-Back): left out when the game did not send it
      ...(result.hitCount !== undefined && {
        hitCount: result.hitCount,
        missCount: result.missCount,
        falseAlarmCount: result.falseAlarmCount,
        rejectCount: result.rejectCount,
        avgResponseMs: result.avgResponseMs,
      }),
    },
  });
  return response.session;
}

/** One user's sessions, oldest -> newest (the order Chart.js needs). */
export async function getUserSessions(userId, gameType = "All") {
  const params = new URLSearchParams({ userId: String(userId), gameType });
  const response = await request(`/sessions?${params}`);
  return response.sessions;
}

/** FR019 - Admin: sessions of ALL users. */
export async function getAllSessions(gameType = "All") {
  const response = await request(`/sessions/all?${new URLSearchParams({ gameType })}`);
  return response.sessions;
}

/** Summary numbers for the dashboard cards (worked out here, no request). */
export function calculateStats(sessions) {
  if (!sessions.length) return { totalGames: 0, averageScore: 0, bestScore: 0 };
  const scores = sessions.map((s) => s.score);
  const total = scores.reduce((sum, n) => sum + n, 0);
  return {
    totalGames: sessions.length,
    averageScore: Math.round((total / scores.length) * 10) / 10,
    bestScore: Math.max(...scores),
  };
}

/** Browser time zone as "+08:00", so "a day" means the user's day. */
function timeZoneOffset() {
  const minutes = -new Date().getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Days in a row (ending today or yesterday) with at least one game. */
export async function getPlayStreak(userId) {
  const params = new URLSearchParams({ userId: String(userId), tz: timeZoneOffset() });
  const response = await request(`/sessions/streak?${params}`);
  return response.streak;
}

// ------------------------------------------------------------
// 7. SYSTEM CONFIGURATION  (FR023)   - route: /api/config
// ------------------------------------------------------------

const DEFAULT_CONFIG = {
  nBackRoundsPerGame: 20,
  nBackDisplaySeconds: 2,
  match3StuckSeconds: 30,
  nBackIncreaseStreak: 3,
  nBackDecreaseStreak: 2,
  match3IncreaseStreak: 3,
  voiceEnabled: true,
  maintenanceMode: false,
};

/** Read system settings. Falls back to the defaults if the API cannot answer. */
export async function getSystemConfig() {
  try {
    const response = await request("/config");
    return { ...DEFAULT_CONFIG, ...response.config };
  } catch (err) {
    return { ...DEFAULT_CONFIG };
  }
}

/** Admin: change settings. */
export async function updateSystemConfig(adminId, changes) {
  const response = await request("/config", { method: "PATCH", body: changes });
  return response.config;
}