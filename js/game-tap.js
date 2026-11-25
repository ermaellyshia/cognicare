/**
 * CogniCare - game-tap.js  (Tekan Pantas / Quick Tap = bubble tracking)
 * 8 rounds. Each round has 3 phases, then a short reveal:
 *   look  : some bubbles are marked. The player presses "I remember".
 *   track : all bubbles look the same and move for a few seconds.
 *   pick  : bubbles stop. The player taps the ones they followed, then "Check".
 *   reveal: right / wrong / missed bubbles are shown with marks; "Continue".
 * The tracking phase has a fixed length (it is the stimulus); the player can
 * rest as long as they like before each round (no time limit to answer).
 * Level rule: up after 3 sessions >= 80% accuracy at the same level,
 * down when the last session is < 50%.
 * Saved for the AI recommender: attempt_count (= bubbles to find), correct_count,
 * avg_response_ms (time spent in the pick phase).
 */
import { t, applyTranslations } from "./translations.js";
import { requireAuth } from "./auth.js";
import * as api from "./firebase-config.js";

// ---------- Settings ----------
const GAME_TYPE = "Quick Tap";
const ROUNDS = 5;
const TRACK_MS = 6000;      // how long the bubbles move
const BUBBLE = 60;          // px, same as .bubble in css/app.css
const REF_WIDTH = 440;      // speeds below are for an arena this wide

// "label" must match difficulty_levels.level_label (migration 008)
// speed = pixels per second in a 440px arena
const LEVELS = [
  { label: "Track 2 of 5",  targets: 2, bubbles: 5,  speed: 70  },
  { label: "Track 2 of 7",  targets: 2, bubbles: 7,  speed: 80  },
  { label: "Track 3 of 8",  targets: 3, bubbles: 8,  speed: 105 },
  { label: "Track 3 of 10", targets: 3, bubbles: 10, speed: 115 },
  { label: "Track 4 of 12", targets: 4, bubbles: 12, speed: 140 },
];

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Page elements ----------
const $ = (id) => document.getElementById(id);
const el = {
  intro: $("intro"), play: $("play"), result: $("result"),
  levelText: $("level-text"), howText: $("how-text"), startBtn: $("start-btn"),
  round: $("round"), prompt: $("prompt"), arena: $("arena"),
  actionBtn: $("action-btn"), status: $("status"),
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

// ---------- Level logic (same rules as the other games) ----------
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
function show(section) {
  [el.intro, el.play, el.result].forEach((s) => (s.hidden = s !== section));
}

function updateIntroTexts() {
  const lv = level();
  el.levelText.textContent = t("tapLevel", {
    n: levelIndex + 1, total: LEVELS.length, targets: lv.targets, bubbles: lv.bubbles,
  });
    el.howText.textContent = t("tapHow", { targets: lv.targets, rounds: ROUNDS });
}

// ---------- Bubbles ----------
function arenaSize() {
  return { w: el.arena.clientWidth, h: el.arena.clientHeight };
}
function placeBubble(b) {
  b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
}
function bubbleLabel(b, i) {
  if (game.phase === "look" && b.target) return t("tapBubbleMarked", { n: i + 1 });
  if (game.phase === "pick" && b.chosen) return t("tapBubbleChosen", { n: i + 1 });
  return t("tapBubble", { n: i + 1 });
}
function refreshBubbleLabels() {
  el.arena.setAttribute("aria-label", t("tapArena"));
  game?.bubbles.forEach((b, i) => b.el.setAttribute("aria-label", bubbleLabel(b, i)));
}

/** Create this round's bubbles at random, non-overlapping positions. */
function buildBubbles() {
  const { targets, bubbles: count } = level();
  const { w, h } = arenaSize();
  const maxX = w - BUBBLE;
  const maxY = h - BUBBLE;
  const targetFlags = shuffle(Array.from({ length: count }, (_, i) => i < targets));

  el.arena.innerHTML = "";
  const list = [];
  targetFlags.forEach((isTarget, i) => {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 200; tries++) {
      x = Math.random() * maxX;
      y = Math.random() * maxY;
      const clear = list.every((o) => Math.hypot(o.x - x, o.y - y) > BUBBLE + 10);
      if (clear) break;
    }
    const angle = Math.random() * Math.PI * 2;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bubble";
    btn.disabled = true;
    btn.addEventListener("click", () => onBubble(i));
    el.arena.appendChild(btn);
    const b = { el: btn, x, y, vx: Math.cos(angle), vy: Math.sin(angle), target: isTarget, chosen: false };
    placeBubble(b);
    list.push(b);
  });
  game.bubbles = list;
}

// ---------- Phases ----------
function startGame() {
  game = {
    round: 0, phase: "look", bubbles: [],
    attempts: 0, correct: 0, times: [],
    pickStart: 0, raf: 0,
    startedAt: Date.now(),
  };
  show(el.play);
  nextRound();
}

/** Phase 1: look. Targets are marked; the player decides when to start. */
function nextRound() {
  game.round++;
  game.phase = "look";
  buildBubbles();
  game.bubbles.forEach((b) => {
    if (b.target) b.el.classList.add("is-marked");
  });
  el.status.textContent = "";
  el.actionBtn.hidden = false;
  renderPlayTexts();
}

/** Phase 2: track. All bubbles look the same and move. */
function startTrack() {
  game.phase = "track";
  game.bubbles.forEach((b) => b.el.classList.remove("is-marked"));
  el.actionBtn.hidden = true;
  renderPlayTexts();

  const { w, h } = arenaSize();
  const maxX = w - BUBBLE;
  const maxY = h - BUBBLE;
  const speed = level().speed * (w / REF_WIDTH) * (reducedMotion ? 0.6 : 1);
  const startedAt = performance.now();
  let last = startedAt;

  function frame(now) {
    if (game.phase !== "track") return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const list = game.bubbles;

    list.forEach((b) => {
      b.x += b.vx * speed * dt;
      b.y += b.vy * speed * dt;
      if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); }
      if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx); }
      if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); }
      if (b.y > maxY) { b.y = maxY; b.vy = -Math.abs(b.vy); }
    });

    // Bubbles bounce off each other (equal mass), so they never sit on top of each other
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const c = list[j];
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < BUBBLE) {
          const nx = dx / dist;
          const ny = dy / dist;
          const push = (BUBBLE - dist) / 2;
          a.x -= nx * push; a.y -= ny * push;
          c.x += nx * push; c.y += ny * push;
          const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rv < 0) {
            a.vx += rv * nx; a.vy += rv * ny;
            c.vx -= rv * nx; c.vy -= rv * ny;
          }
        }
      }
    }

    list.forEach((b) => {
      const len = Math.hypot(b.vx, b.vy) || 1;   // keep every bubble at the same speed
      b.vx /= len;
      b.vy /= len;
      b.x = Math.min(maxX, Math.max(0, b.x));
      b.y = Math.min(maxY, Math.max(0, b.y));
      placeBubble(b);
    });

    if (now - startedAt >= TRACK_MS) startPick();
    else game.raf = requestAnimationFrame(frame);
  }
  game.raf = requestAnimationFrame(frame);
}

/** Phase 3: pick. Bubbles stop and can be tapped. */
function startPick() {
  cancelAnimationFrame(game.raf);
  game.phase = "pick";
  game.pickStart = Date.now();
  game.bubbles.forEach((b) => {
    b.el.disabled = false;
    b.el.classList.add("is-pickable");
  });
  el.actionBtn.hidden = false;
  el.status.textContent = t("tapPicked", { a: 0, n: level().targets });
  renderPlayTexts();
}

function chosenCount() {
  return game.bubbles.filter((b) => b.chosen).length;
}

function onBubble(i) {
  if (!game || game.phase !== "pick") return;
  const b = game.bubbles[i];
  if (!b.chosen && chosenCount() >= level().targets) return; // choose at most "targets"
  b.chosen = !b.chosen;
  b.el.classList.toggle("is-chosen", b.chosen);
  b.el.setAttribute("aria-label", bubbleLabel(b, i));
  el.status.textContent = t("tapPicked", { a: chosenCount(), n: level().targets });
}

/** Check the answer, then show right / wrong / missed. */
function checkAnswer() {
  const need = level().targets;
  if (chosenCount() < need) {
    el.status.textContent = t("tapNeedMore", { n: need });
    return;
  }
  game.phase = "reveal";
  game.times.push(Date.now() - game.pickStart);

  let right = 0;
  game.bubbles.forEach((b) => {
    b.el.disabled = true;
    b.el.classList.remove("is-pickable", "is-chosen");
    if (b.chosen && b.target) { b.el.classList.add("is-right"); right++; }
    else if (b.chosen && !b.target) b.el.classList.add("is-wrong");
    else if (!b.chosen && b.target) b.el.classList.add("is-missed");
  });
  game.attempts += need;
  game.correct += right;

  el.status.textContent = right === need ? t("tapRoundAll") : t("tapRoundPart", { right, n: need });
  renderPlayTexts();
}

function onAction() {
  if (!game) return;
  if (game.phase === "look") startTrack();
  else if (game.phase === "pick") checkAnswer();
  else if (game.phase === "reveal") {
    if (game.round >= ROUNDS) finishGame();
    else nextRound();
  }
}

/** Text that depends on the phase (also used after a language change). */
function renderPlayTexts() {
  if (!game) return;
  el.round.textContent = t("tapRound", { n: game.round, total: ROUNDS });
  const targets = level().targets;

  if (game.phase === "look") {
    el.prompt.textContent = t("tapPromptLook");
    el.actionBtn.textContent = t("tapRemember");
  } else if (game.phase === "track") {
    el.prompt.textContent = t("tapPromptTrack");
  } else if (game.phase === "pick") {
    el.prompt.textContent = t("tapPromptPick", { n: targets });
    el.actionBtn.textContent = t("tapCheck");
  } else if (game.phase === "reveal") {
    el.prompt.textContent = "";
    el.actionBtn.textContent = t("continue");
  }
  refreshBubbleLabels();
}

// ---------- Finish ----------
async function finishGame() {
  cancelAnimationFrame(game.raf);
  const attempts = game.attempts;       // bubbles to find over all rounds
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

  lastResult = { correct, attempts, accuracy, avgMs, before, after: levelIndex };
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
  const { correct, attempts, accuracy, avgMs, before, after } = lastResult;
  el.resRounds.textContent = t("tapResultRounds", { right: correct, total: attempts });
  el.resAcc.textContent = t("tapResultAccuracy", { n: accuracy });
  el.resTime.textContent = t("tapResultTime", { n: (avgMs / 1000).toFixed(1) });
  const key = after > before ? "tapNextLevel" : after < before ? "tapEasier" : "tapSameLevel";
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
  updateIntroTexts();
  show(el.intro);

  el.startBtn.addEventListener("click", startGame);
  el.actionBtn.addEventListener("click", onAction);
  el.againBtn.addEventListener("click", () => {
    updateIntroTexts();
    startGame();
  });

  window.addEventListener("languagechange", () => {
    updateIntroTexts();
    renderPlayTexts();
    renderResult();
  });
}

init();