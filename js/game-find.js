/**
 * CogniCare - game-find.js  (Cari Sasaran / Find the Target = Stroop style)
 * Attention game. 12 rounds, no time limit. One tap per round.
 *   Levels 1-3 ("word"):  a colour word is shown; tap the INK colour.
 *   Levels 4-5 ("shape"): a shape with a coloured border and a word inside;
 *                         tap the BORDER colour and ignore the word.
 * Level rule: up after 3 sessions >= 80% accuracy at the same level,
 * down when the last session is < 50%.
 * Reaction time (avg_response_ms) is saved for the AI recommender.
 */
import { t, applyTranslations } from "./translations.js";
import { requireAuth } from "./auth.js";
import * as api from "./firebase-config.js";

// ---------- Settings ----------
const GAME_TYPE = "Find the Target";
const ROUNDS = 12;

// "label" must match difficulty_levels.level_label (migration 006)
const LEVELS = [
  { label: "3 colours easy",       colours: 3, mismatch: 0.25, mode: "word"  },
  { label: "3 colours mixed",      colours: 3, mismatch: 0.5,  mode: "word"  },
  { label: "4 colours hard",       colours: 4, mismatch: 0.75, mode: "word"  },
  { label: "Shape 4 colours",      colours: 4, mismatch: 0.5,  mode: "shape" },
  { label: "Shape 5 colours hard", colours: 5, mismatch: 1,    mode: "shape" },
];

// Fixed order, so the buttons stay in the same place every round
const COLOURS = [
  { id: "red",    key: "colRed",    ink: "ink-red",    bg: "bg-red",    hex: "#c62828" },
  { id: "blue",   key: "colBlue",   ink: "ink-blue",   bg: "bg-blue",   hex: "#1d4e9e" },
  { id: "green",  key: "colGreen",  ink: "ink-green",  bg: "bg-green",  hex: "#2b7a3d" },
  { id: "orange", key: "colOrange", ink: "ink-orange", bg: "bg-orange", hex: "#b85500" },
  { id: "purple", key: "colPurple", ink: "ink-purple", bg: "bg-purple", hex: "#6a2c91" },
];
const SHAPES = ["circle", "square", "triangle"];

// ---------- Page elements ----------
const $ = (id) => document.getElementById(id);
const el = {
  intro: $("intro"), play: $("play"), result: $("result"),
  levelText: $("level-text"), howText: $("how-text"), example: $("example"),
  startBtn: $("start-btn"),
  round: $("round"), prompt: $("prompt"), stimulus: $("stimulus"),
  answers: $("answers"), status: $("status"),
  resRounds: $("res-rounds"), resAcc: $("res-accuracy"), resTime: $("res-time"),
  resLevel: $("res-level"), saveStatus: $("save-status"), againBtn: $("again-btn"),
};

// ---------- State ----------
let levelIndex = 0;      // 0..4
let history = [];        // past sessions of this game, newest first
let game = null;         // current game
let lastResult = null;   // for re-rendering text after a language change
let userId = null;       // logged-in user

const level = () => LEVELS[levelIndex];
const activeColours = () => COLOURS.slice(0, level().colours);

// ---------- Level logic (same rules as Card Pairs) ----------
function readLevelIndex(session) {
  const text = String(session.difficultyLevel ?? session.difficulty ?? session.levelLabel ?? "");
  const i = LEVELS.findIndex((l) => l.label === text);
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

/** sessions = newest first. Returns the level index to play next. */
function decideLevel(sessions) {
  const mine = sessions
    .filter((s) => readLevelIndex(s) !== null && readAccuracy(s) !== null)
    .sort((a, b) => readDate(b) - readDate(a));
  if (mine.length === 0) return 0;

  const current = readLevelIndex(mine[0]);
  if (readAccuracy(mine[0]) < 50) return Math.max(0, current - 1);

  const atLevel = mine.filter((s) => readLevelIndex(s) === current).slice(0, 3);
  const threeGood = atLevel.length === 3 && atLevel.every((s) => readAccuracy(s) >= 80);
  if (threeGood) return Math.min(LEVELS.length - 1, current + 1);
  return current;
}

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
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function show(section) {
  [el.intro, el.play, el.result].forEach((s) => (s.hidden = s !== section));
}

/**
 * HTML for one stimulus.
 *  word mode : the word is written in the INK colour
 *  shape mode: the shape has a BORDER colour, the word inside is only a distraction
 */
function stimulusHTML(mode, shape, wordColour, answerColour) {
  const word = t(wordColour.key);
  if (mode === "word") {
    return `<span class="stroop-word ${answerColour.ink}">${word}</span>`;
  }
  const stroke = `fill="#fff" stroke="${answerColour.hex}" stroke-width="12" stroke-linejoin="round"`;
  let outline = "";
  let textY = 108;
  let size = 26;
  if (shape === "circle") {
    outline = `<circle cx="100" cy="100" r="84" ${stroke}/>`;
  } else if (shape === "square") {
    outline = `<rect x="16" y="16" width="168" height="168" rx="10" ${stroke}/>`;
  } else {
    outline = `<polygon points="100,14 188,176 12,176" ${stroke}/>`;
    textY = 142;
    size = 22;
  }
  return `<span class="stroop-shape"><svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">${outline}<text x="100" y="${textY}" text-anchor="middle" font-size="${size}">${word}</text></svg></span>`;
}

// ---------- Intro screen ----------
function renderIntro() {
  const lv = level();
  el.levelText.textContent = t("findLevel", { n: levelIndex + 1, total: LEVELS.length });
  el.howText.textContent = t(lv.mode === "word" ? "findHowWord" : "findHowShape");

  // Example: the word RED/MERAH in blue (or on a blue-bordered shape) -> press BLUE
  const red = COLOURS[0];
  const blue = COLOURS[1];
  const exampleKey = lv.mode === "word" ? "findExampleWord" : "findExampleShape";
  el.example.innerHTML =
    `<div class="stroop-stimulus">${stimulusHTML(lv.mode, "triangle", red, blue)}</div>` +
    `<p>${t(exampleKey)}</p>`;
}

// ---------- Game ----------
function buildTrials() {
  const colours = activeColours();
  const mismatchCount = Math.round(level().mismatch * ROUNDS);
  const flags = shuffle(Array.from({ length: ROUNDS }, (_, i) => i < mismatchCount));

  return flags.map((isMismatch) => {
    const answer = pick(colours);
    const wordColour = isMismatch ? pick(colours.filter((c) => c.id !== answer.id)) : answer;
    return { answer, wordColour, shape: pick(SHAPES) };
  });
}

function startGame() {
  game = {
    trials: buildTrials(),
    round: 0, correct: 0, times: [],
    trialStart: 0, locked: true,
    startedAt: Date.now(),
  };

  // Colour buttons: created once per game
  el.answers.innerHTML = "";
  activeColours().forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `answer-btn ${c.bg}`;
    b.dataset.id = c.id;
    b.textContent = t(c.key);
    b.addEventListener("click", () => onAnswer(b));
    el.answers.appendChild(b);
  });

  nextRound();
  show(el.play);
}

function renderTrial() {
  const trial = game.trials[game.round - 1];
  el.stimulus.innerHTML = stimulusHTML(level().mode, trial.shape, trial.wordColour, trial.answer);
}
function renderPlayTexts() {
  if (!game) return;
  el.round.textContent = t("findRound", { n: game.round, total: ROUNDS });
  el.prompt.textContent = t(level().mode === "word" ? "findPromptWord" : "findPromptShape");
  el.answers.setAttribute("aria-label", t("findAnswers"));
  el.answers.querySelectorAll(".answer-btn").forEach((b) => {
    const c = COLOURS.find((x) => x.id === b.dataset.id);
    b.textContent = t(c.key);
  });
}

function nextRound() {
  game.round++;
  el.answers.querySelectorAll(".answer-btn").forEach((b) => b.classList.remove("is-right", "is-wrong"));
  el.status.textContent = "";
  renderTrial();
  renderPlayTexts();
  game.locked = false;
  game.trialStart = Date.now();
}

function onAnswer(btn) {
  if (!game || game.locked) return;
  game.locked = true;
  game.times.push(Date.now() - game.trialStart);

  const trial = game.trials[game.round - 1];
  const right = btn.dataset.id === trial.answer.id;

  if (right) {
    game.correct++;
    btn.classList.add("is-right");
    el.status.textContent = t("findCorrect");
  } else {
    btn.classList.add("is-wrong");
    // Show the right button too, so the player learns (mark, not colour only)
    el.answers.querySelector(`[data-id="${trial.answer.id}"]`)?.classList.add("is-right");
    el.status.textContent = t("findWrong");
  }

  setTimeout(() => {
    if (game.round >= ROUNDS) finishGame();
    else nextRound();
  }, right ? 900 : 1500);
}

async function finishGame() {
  const attempts = ROUNDS;           // one tap per round
  const correct = game.correct;
  const accuracy = Math.round((correct / attempts) * 100);
  const seconds = Math.round((Date.now() - game.startedAt) / 1000);
  const avgMs = Math.round(game.times.reduce((s, x) => s + x, 0) / Math.max(1, game.times.length));
  const playedLabel = level().label;

  // Decide the next level, counting this session as the newest one
  const thisSession = { difficultyLevel: playedLabel, accuracyPct: accuracy, playedAt: new Date().toISOString() };
  const before = levelIndex;
  levelIndex = decideLevel([thisSession, ...history]);
  history = [thisSession, ...history];

  lastResult = { correct, accuracy, avgMs, before, after: levelIndex };
  renderResult();
  show(el.result);
  el.againBtn.focus();

  el.saveStatus.textContent = t("loading");
  try {
    await api.saveGameSession(userId, {
      gameType: GAME_TYPE,
      difficultyLevel: playedLabel,
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
  const { correct, accuracy, avgMs, before, after } = lastResult;
  el.resRounds.textContent = t("findResultRounds", { right: correct, total: ROUNDS });
  el.resAcc.textContent = t("findResultAccuracy", { n: accuracy });
  el.resTime.textContent = t("findResultTime", { n: (avgMs / 1000).toFixed(1) });
  const key = after > before ? "findNextLevel" : after < before ? "findEasier" : "findSameLevel";
  el.resLevel.textContent = t(key, { n: after + 1 });
}

// ---------- Start ----------
async function init() {
  await requireAuth(["elderly"]);
  applyTranslations();

  const me = await api.getCurrentUserProfile();
  userId = me?.id ?? me?.uid ?? me?.userId;

  history = await loadHistory();
  levelIndex = decideLevel(history);
  renderIntro();
  show(el.intro);

  el.startBtn.addEventListener("click", startGame);
  el.againBtn.addEventListener("click", () => {
    renderIntro();
    startGame();
  });

  window.addEventListener("languagechange", () => {
    renderIntro();
    if (game && !el.play.hidden) {
      renderTrial();
      renderPlayTexts();
    }
    renderResult();
  });
}

init();