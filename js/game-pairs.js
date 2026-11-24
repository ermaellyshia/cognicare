/**
 * CogniCare - game-pairs.js  (Padankan Kad / Card Pairs)
 * Memory game. No time limit. Levels: 4/6/8/12/16 cards.
 * Level rule: up after 3 sessions >= 80% accuracy at the same level,
 * down when the last session is < 50%.
 */
import { t, applyTranslations } from "./translations.js";
import { requireAuth } from "./auth.js";
import * as api from "./firebase-config.js";

// ---------- Settings ----------
const GAME_TYPE = "Card Pairs";
const CARD_COUNTS = [4, 6, 8, 12, 16]; // level 1..5
const label = (cards) => `${cards} cards`; // must match difficulty_levels.level_label

// ---------- Symbols (shape is the main clue, colour only helps) ----------
const SYMBOLS = [
  { key: "symCircle",   svg: '<circle cx="50" cy="50" r="36" fill="#1d4e9e"/>' },
  { key: "symSquare",   svg: '<rect x="16" y="16" width="68" height="68" rx="6" fill="#b3261e"/>' },
  { key: "symTriangle", svg: '<polygon points="50,12 90,86 10,86" fill="#2b6e3f"/>' },
  { key: "symStar",     svg: '<polygon points="50,8 61,38 93,38 67,57 77,89 50,70 23,89 33,57 7,38 39,38" fill="#9a6700"/>' },
  { key: "symHeart",    svg: '<path d="M50 88 C10 56 8 22 30 18 C42 16 50 26 50 30 C50 26 58 16 70 18 C92 22 90 56 50 88Z" fill="#a31d6b"/>' },
  { key: "symMoon",     svg: '<path d="M62 10 A40 40 0 1 0 90 62 A32 32 0 1 1 62 10Z" fill="#4a3f9e"/>' },
  { key: "symSun",      svg: '<circle cx="50" cy="50" r="20" fill="#c25e00"/><g stroke="#c25e00" stroke-width="7" stroke-linecap="round"><line x1="50" y1="8" x2="50" y2="20"/><line x1="50" y1="80" x2="50" y2="92"/><line x1="8" y1="50" x2="20" y2="50"/><line x1="80" y1="50" x2="92" y2="50"/><line x1="20" y1="20" x2="28" y2="28"/><line x1="72" y1="72" x2="80" y2="80"/><line x1="80" y1="20" x2="72" y2="28"/><line x1="20" y1="80" x2="28" y2="72"/></g>' },
  { key: "symLeaf",     svg: '<path d="M14 86 C10 40 40 10 90 10 C90 60 60 90 14 86Z" fill="#1f7a4d"/><line x1="14" y1="86" x2="60" y2="40" stroke="#fff" stroke-width="5"/>' },
];
const svgOf = (s) => `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${s.svg}</svg>`;

// ---------- Page elements ----------
const $ = (id) => document.getElementById(id);
const el = {
  intro: $("intro"), play: $("play"), result: $("result"),
  levelText: $("level-text"), startBtn: $("start-btn"),
  tries: $("tries"), found: $("found"), board: $("board"), status: $("status"),
  resTries: $("res-tries"), resAcc: $("res-accuracy"), resTime: $("res-time"),
  resLevel: $("res-level"), saveStatus: $("save-status"), againBtn: $("again-btn"),
};

// ---------- State ----------
let levelIndex = 0;      // 0..4
let history = [];        // past sessions of this game, newest first
let game = null;         // current game
let lastResult = null;   // for re-rendering text after language change
let userId = null;       // logged-in user
let readyBtn = null;     // "I remember them" button (study phase)
// ---------- Level logic ----------
function readLevelIndex(session) {
  const text = String(session.difficultyLevel ?? session.difficulty ?? session.levelLabel ?? "");
  const n = parseInt(text, 10);
  const i = CARD_COUNTS.indexOf(n);
  return i === -1 ? null : i;
}
function readAccuracy(session) {
  const a = session.accuracyPct ?? session.accuracy;
  if (a !== undefined && a !== null) return Number(a);
  const tries = Number(session.attemptCount);
  const right = Number(session.correctCount);
  return tries > 0 ? Math.round((right / tries) * 100) : null;
}
function readDate(session) {
  const d = new Date(session.playedAt ?? session.createdAt ?? session.date ?? 0);
  return isNaN(d) ? 0 : d.getTime();
}

/** history = sessions newest first. Returns the level index to play next. */
function decideLevel(sessions) {
  const mine = sessions
    .filter((s) => readLevelIndex(s) !== null && readAccuracy(s) !== null)
    .sort((a, b) => readDate(b) - readDate(a));
  if (mine.length === 0) return 0;

  const current = readLevelIndex(mine[0]);
  if (readAccuracy(mine[0]) < 50) return Math.max(0, current - 1);

  const atLevel = mine.filter((s) => readLevelIndex(s) === current).slice(0, 3);
  const threeGood = atLevel.length === 3 && atLevel.every((s) => readAccuracy(s) >= 80);
  if (threeGood) return Math.min(CARD_COUNTS.length - 1, current + 1);
  return current;
}

/** Load past sessions. If the API function is not found, start at level 1. */
async function loadHistory() {
  try {
    const list = await api.getUserSessions(userId, GAME_TYPE);
    // API returns oldest -> newest; we want newest first
    return [...list].reverse();
  } catch {
    return [];
  }
}

// ---------- Helpers ----------
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function show(section) {
  [el.intro, el.play, el.result].forEach((s) => (s.hidden = s !== section));
}
function cardsNow() { return CARD_COUNTS[levelIndex]; }

function updateLevelText() {
  el.levelText.textContent = t("pairsLevel", { n: levelIndex + 1, cards: cardsNow() });
}
function updateScore() {
  if (!game) return;
  el.tries.textContent = t("pairsTries", { n: game.attempts });
  el.found.textContent = t("pairsFound", { found: game.correct, total: game.pairs });
}
function tileLabel(tile) {
  const n = Number(tile.dataset.n);
  if (tile.classList.contains("is-open") || tile.classList.contains("is-matched")) {
    return t("pairsCardShown", { n, name: t(SYMBOLS[Number(tile.dataset.sym)].key) });
  }
  return t("pairsCardHidden", { n });
}
function refreshLabels() {
  el.board.setAttribute("aria-label", t("pairsBoard"));
    el.board.querySelectorAll(".tile").forEach((tile) => tile.setAttribute("aria-label", tileLabel(tile)));
  if (readyBtn) readyBtn.textContent = t("pairsReady");
}

// ---------- Game ----------
function startGame() {
  const cards = cardsNow();
  const pairs = cards / 2;
  const chosen = shuffle(SYMBOLS).slice(0, pairs);
  const deck = shuffle([...chosen, ...chosen].map((s) => SYMBOLS.indexOf(s)));

  game = {
    pairs, attempts: 0, correct: 0,
    open: [], locked: true,
    startedAt: Date.now(), lastTap: Date.now(), gaps: [],
  };

  el.board.innerHTML = "";
  el.board.dataset.cards = String(cards);
  deck.forEach((symIndex, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tile";
    b.dataset.n = String(i + 1);
    b.dataset.sym = String(symIndex);
    b.textContent = "?";
    b.addEventListener("click", () => onTap(b));
    el.board.appendChild(b);
  });

    el.status.textContent = t("pairsStudy");
  updateScore();

  // Study phase: show every card until the player is ready
  el.board.querySelectorAll(".tile").forEach(openTile);
  readyBtn?.remove();
  readyBtn = document.createElement("button");
  readyBtn.type = "button";
  readyBtn.className = "btn";
  readyBtn.textContent = t("pairsReady");
  readyBtn.addEventListener("click", endStudy);
  el.board.after(readyBtn);

  refreshLabels();
  show(el.play);
  readyBtn.focus();
}

function endStudy() {
  readyBtn?.remove();
  readyBtn = null;
  el.board.querySelectorAll(".tile").forEach(closeTile);
  el.status.textContent = t("pairsNowFind");
  game.startedAt = Date.now(); // timing counts only the searching part
  game.lastTap = Date.now();
  game.locked = false;
  el.board.querySelector(".tile")?.focus();
}

function openTile(tile) {
  tile.classList.add("is-open");
  tile.innerHTML = svgOf(SYMBOLS[Number(tile.dataset.sym)]);
  tile.setAttribute("aria-label", tileLabel(tile));
}
function closeTile(tile) {
  tile.classList.remove("is-open");
  tile.textContent = "?";
  tile.setAttribute("aria-label", tileLabel(tile));
}

function onTap(tile) {
  if (!game || game.locked) return;
  if (tile.classList.contains("is-open") || tile.classList.contains("is-matched")) return;

  const now = Date.now();
  game.gaps.push(now - game.lastTap);
  game.lastTap = now;

  openTile(tile);
  game.open.push(tile);
  if (game.open.length < 2) return;

  game.attempts++;
  const [a, b] = game.open;
  if (a.dataset.sym === b.dataset.sym) {
    [a, b].forEach((x) => {
      x.classList.remove("is-open");
      x.classList.add("is-matched");
      x.setAttribute("aria-label", tileLabel(x));
    });
    game.correct++;
    game.open = [];
    el.status.textContent = t("pairsMatch");
    updateScore();
    if (game.correct === game.pairs) setTimeout(finishGame, 900);
  } else {
    game.locked = true;
    el.status.textContent = t("pairsNoMatch");
    updateScore();
    setTimeout(() => {
      closeTile(a);
      closeTile(b);
      game.open = [];
      game.locked = false;
    }, 1400); // long enough for an older adult to see both cards
  }
}

async function finishGame() {
  const attempts = game.attempts;
  const correct = game.correct;
  const accuracy = Math.round((correct / attempts) * 100);
  const seconds = Math.round((Date.now() - game.startedAt) / 1000);
  const avgMs = Math.round(game.gaps.reduce((s, x) => s + x, 0) / Math.max(1, game.gaps.length));
  const playedCards = cardsNow();

  // Decide next level, counting this session as the newest one
  const thisSession = { difficultyLevel: label(playedCards), accuracyPct: accuracy, playedAt: new Date().toISOString() };
  const before = levelIndex;
  levelIndex = decideLevel([thisSession, ...history]);
  history = [thisSession, ...history];

  lastResult = { attempts, accuracy, seconds, before, after: levelIndex };
  renderResult();
  show(el.result);
  el.againBtn.focus();

  // Save to the database
  el.saveStatus.textContent = t("loading");
  try {
    await api.saveGameSession(userId, {
      gameType: GAME_TYPE,
      difficultyLevel: label(playedCards),
      score: accuracy,
      duration: seconds,
      attemptCount: attempts,
      correctCount: correct,
      avgResponseMs: avgMs,
    });
    el.saveStatus.textContent = t("gameSaved");
  } catch {
    el.saveStatus.textContent = t("gameSaveFailed");
  }
}

function renderResult() {
  if (!lastResult) return;
  const { attempts, accuracy, seconds, before, after } = lastResult;
  el.resTries.textContent = t("pairsResultTries", { n: attempts });
  el.resAcc.textContent = t("pairsResultAccuracy", { n: accuracy });
  el.resTime.textContent = t("pairsResultTime", { n: seconds });
  const cards = CARD_COUNTS[after];
  const key = after > before ? "pairsNextLevel" : after < before ? "pairsEasier" : "pairsSameLevel";
  el.resLevel.textContent = t(key, { cards });
}

// ---------- Start ----------
async function init() {
  await requireAuth(["elderly"]);
  applyTranslations();

  const me = await api.getCurrentUserProfile();
  userId = me?.id ?? me?.uid ?? me?.userId;

  history = await loadHistory();
  levelIndex = decideLevel(history);
  updateLevelText();
  show(el.intro);

  el.startBtn.addEventListener("click", startGame);
  el.againBtn.addEventListener("click", () => {
    updateLevelText();
    startGame();
  });

  window.addEventListener("languagechange", () => {
    updateLevelText();
    updateScore();
    refreshLabels();
    renderResult();
  });
}

init();