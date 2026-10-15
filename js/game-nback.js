/**
 * ============================================================
 * CogniCare - game-nback.js
 * ------------------------------------------------------------
 * N-Back working-memory game.  FR011, FR013, FR014, FR016
 *
 * HOW THE GAME WORKS
 *  - A number from 1 to 9 is shown for 2 seconds.
 *  - The player says YES if it is the SAME as the number n steps
 *    ago (n = 1, 2 or 3), otherwise NO.
 *  - Green flash + tick = correct, red flash + cross = wrong.
 *  - The AI engine (ai-difficulty.js) changes n while playing:
 *      3 correct in a row -> harder,  2 wrong in a row -> easier.
 *  - There is NO time limit for answering. Only the number
 *    disappears after 2 seconds; the buttons stay until pressed.
 *  - The first n numbers of a game have nothing to compare with,
 *    so they are "remember this number" warm-up numbers
 *    (not scored, not counted in the progress bar).
 *  - PRACTICE ROUND: a short scripted 1-back example (4 numbers),
 *    player-paced with explanations. Not scored, not saved.
 *    The intro suggests it until the player has finished it once
 *    (remembered per user in localStorage, optional).
 *  - PAUSE: the player can pause at any time. The number on screen is
 *    discarded (not counted, so nothing is lost) and shown again as a
 *    new round after "Resume". Paused time is not added to the duration.
 *
 * SCORING (explain this in your report)
 *    10 points x current n  for every correct answer.
 *    So a correct answer at 3-back is worth 30 points.
 *
 * SAVING (FR016)
 *    When the game ends it is saved to Firestore automatically:
 *    gameType "N-Back", score, difficultyLevel (the HIGHEST level
 *    reached, e.g. "2-back"), duration (seconds), completed.
 *    If saving fails the player sees a "Try again" button.
 *
 * HOW app.js STARTS THIS GAME
 *    startGame({ container, profile, onExit })  ->  returns cleanup()
 *
 * VOICE ASSISTANT HOOK (voice-assistant.js is written later)
 *    This file looks for:   export function createVoice({ onCommand })
 *    that returns an object with:
 *       supported            true/false
 *       speak(text)          say the text aloud
 *       startListening()     start voice commands
 *       stopListening()
 *       setEnabled(bool)     voice on / off
 *       destroy()
 *    onCommand("yes" | "no" | "start") is called when a spoken
 *    command is recognised. If the file or function does not exist
 *    (yet), the game simply works without voice.
 * ============================================================
 */

import { saveGameSession, getSystemConfig } from "./firebase-config.js";
import {
  loadEngineConfig,
  getPersonalStartLevel,
  createEngine,
  formatDifficulty,
} from "./ai-difficulty.js";
import { t, nbackInstruction } from "./translations.js";

// ------------------------------------------------------------
// 1. CONSTANTS
// ------------------------------------------------------------
const POINTS_PER_CORRECT = 10;   // multiplied by the level (n)
const FEEDBACK_MS = 1500;        // how long "Correct!" / "Wrong" stays on screen
const WARMUP_GAP_MS = 700;       // pause after a warm-up number
const DEFAULT_ROUNDS = 20;
const DEFAULT_DISPLAY_MS = 2000; // brief: number shown for 2 seconds
const PRACTICE_SEQUENCE = [4, 7, 7, 2]; // 1-back example: remember, NO, YES, NO

/** Rounds and display time can be changed by the admin (FR023). */
async function loadSettings() {
  try {
    const cfg = await getSystemConfig();
    const rounds = Math.round(Number(cfg.nBackRoundsPerGame));
    const seconds = Number(cfg.nBackDisplaySeconds);
    return {
      rounds: rounds > 0 ? Math.min(rounds, 60) : DEFAULT_ROUNDS,
      displayMs: seconds > 0 ? Math.min(Math.max(seconds * 1000, 1000), 6000) : DEFAULT_DISPLAY_MS,
    };
  } catch (err) {
    console.warn("N-Back: using default settings:", err.message);
    return { rounds: DEFAULT_ROUNDS, displayMs: DEFAULT_DISPLAY_MS };
  }
}

function freshState() {
  return {
    screen: "loading",   // loading | intro | playing | result
    history: [],         // every number shown so far
    round: 0,            // scored rounds finished
    total: DEFAULT_ROUNDS,
    score: 0,
    current: null,       // { value, isMatch, warmup }
    awaiting: false,     // true while the player may answer
    token: 0,            // changes every round, so old timers do nothing
    startedAt: 0,
    numberShownAt: 0,
    note: null,          // level-change message {key, n}
    feedback: null,      // "correct" | "wrong" | null
    payload: null,       // what is saved to Firestore
    saveStatus: "idle",  // idle | saving | saved | failed
    summary: null,
    paused: false,       // true while the pause box is open
    pauseStartedAt: 0,
    pausedMs: 0,         // total paused time (not counted in duration)
  };
}

// ------------------------------------------------------------
// 2. THE GAME
// ------------------------------------------------------------
export function startGame({ container, profile, onExit }) {
  let destroyed = false;
  const timers = new Set();
  let voice = null;
  let voiceOn = true;
  let engine = null;
  let settings = { rounds: DEFAULT_ROUNDS, displayMs: DEFAULT_DISPLAY_MS };
  let state = freshState();
  let practice = null;               // { i, choice } while the practice round runs

  // ---------- small helpers ----------

  /** setTimeout that is cancelled automatically when the game closes. */
  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, ms);
    timers.add(id);
    return id;
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers.clear();
  }

  function speak(text) {
    if (!voice || !voiceOn || !text) return;
    try {
      voice.speak(text);
    } catch (err) {
      console.warn("Voice error:", err);
    }
  }

  const $ = (id) => container.querySelector(`#${id}`);

  // "Has this player done the practice?"  (optional, ignored if storage is blocked)
  const practicedKey = `cognicare_nback_practiced_${profile.userId}`;
  function hasPracticed() {
    try { return localStorage.getItem(practicedKey) === "1"; } catch (e) { return false; }
  }
  function markPracticed() {
    try { localStorage.setItem(practicedKey, "1"); } catch (e) { /* ignore */ }
  }

  /** Create an element in one line (uses textContent = safe). */
  function el(tag, props = {}, text = "") {
    const node = document.createElement(tag);
    Object.assign(node, props);
    if (text) node.textContent = text;
    return node;
  }

  // ---------- voice ----------

  async function loadVoice() {
    try {
      const module = await import("./voice-assistant.js");
      if (typeof module.createVoice === "function") {
        const instance = module.createVoice({ onCommand: handleVoiceCommand });
        if (instance && instance.supported !== false) voice = instance;
      }
    } catch (err) {
      console.info("N-Back: voice assistant not available:", err.message);
    }
  }

  function handleVoiceCommand(command) {
    if (destroyed) return;
    if (command === "start" && state.screen === "intro") startPlaying();
    else if (command === "yes" || command === "no") {
      if (state.screen === "practice") practiceAnswer(command);
      else if (state.awaiting) answer(command);
    }
  }

  function voiceLabel() {
    return t(voiceOn ? "voiceOn" : "voiceOff");
  }

  /** Voice on/off button, shared by the intro and the game screen. */
  function bindVoiceToggle(button) {
    if (!button) return;
    if (!voice) {
      button.hidden = true;
      return;
    }
    button.hidden = false;
    button.textContent = voiceLabel();
    button.setAttribute("aria-pressed", String(voiceOn));
    button.addEventListener("click", () => {
      voiceOn = !voiceOn;
      try {
        voice.setEnabled?.(voiceOn);
        if (voiceOn) voice.startListening?.();
        else voice.stopListening?.();
      } catch (err) {
        console.warn("Voice error:", err);
      }
      button.textContent = voiceLabel();
      button.setAttribute("aria-pressed", String(voiceOn));
    });
  }

  // ---------- preparing a new game ----------

  /** Create a fresh engine (with the player's personal start level). */
  async function prepare() {
    clearTimers();
    state = freshState();
    container.replaceChildren(el("p", { className: "loading", role: "status" }, t("loading")));

    const [config, loaded, start] = await Promise.all([
      loadEngineConfig(),
      loadSettings(),
      getPersonalStartLevel(profile.userId, "N-Back"),
    ]);
    if (destroyed) return;

    settings = loaded;
    engine?.stop();
    engine = createEngine("N-Back", config, { startLevel: start.level });
    state.total = settings.rounds;
    renderIntro();
  }

  // ==========================================================
  // SCREEN 1: INTRO (instructions + start button)   FR013
  // ==========================================================
  function renderIntro() {
    state.screen = "intro";
    container.innerHTML = `
      <section class="game-area" aria-labelledby="nb-title">
        <h2 id="nb-title"></h2>
        <div class="info-bar"><div class="info-item" id="nb-level"></div></div>
        <div class="instructions" id="nb-instr"></div>
        <div class="btn-group" style="justify-content:center">
          <button type="button" class="btn btn-large" id="nb-start"></button>
          <button type="button" class="btn btn-secondary btn-large" id="nb-practice"></button>
          <button type="button" class="btn btn-secondary btn-large" id="nb-read" hidden></button>
          <button type="button" class="btn btn-secondary btn-large" id="nb-voice" hidden></button>
        </div>
        <p class="alert alert-info mt-2" id="nb-practicetip" hidden></p>
        <p class="text-muted mt-2" id="nb-voicetip" hidden></p>
      </section>`;

    fillIntroTexts();
    $("nb-start").addEventListener("click", startPlaying);
    $("nb-practice").addEventListener("click", startPractice);

    if (voice) {
      $("nb-read").hidden = false;
      $("nb-read").addEventListener("click", () => speak(instructionText()));
      $("nb-voicetip").hidden = false;
      bindVoiceToggle($("nb-voice"));
      if (voiceOn) voice.startListening?.();
    }
    // First time: point at the practice round
    if (!hasPracticed()) $("nb-practicetip").hidden = false;
    if (state.justPracticed) $("nb-practicetip").hidden = false;
    $("nb-start").focus();
  }

  function instructionText() {
    return `${t("nbackGeneral")} ${nbackInstruction(engine.level)}`;
  }

  function fillIntroTexts() {
    $("nb-title").textContent = t("nback");
    $("nb-level").textContent = t("nbackLevel", { n: engine.level });
    // General rule + the rule for the current level (in bold)
    const levelRule = el("p");
    levelRule.append(el("strong", {}, nbackInstruction(engine.level)));
    $("nb-instr").replaceChildren(el("p", {}, t("nbackGeneral")), levelRule);
    $("nb-start").textContent = t("startGame");
    $("nb-practice").textContent = t("practice");
    $("nb-practicetip").textContent = state.justPracticed ? t("practiceDone") : t("practiceTip");
    $("nb-read").textContent = t("readAloud");
    $("nb-voicetip").textContent = t("sayStart");
    if (voice) $("nb-voice").textContent = voiceLabel();
  }

  // ==========================================================
  // SCREEN 2: PLAYING
  // ==========================================================
  function renderPlaying() {
    state.screen = "playing";
    container.innerHTML = `
      <section class="game-area" id="nb-panel" aria-label="N-Back">
        <div class="info-bar">
          <div class="info-item" id="nb-score"></div>
          <div class="info-item" id="nb-level"></div>
        </div>

        <div class="progress" id="nb-progress" role="progressbar"
             aria-valuemin="0" aria-valuemax="${state.total}" aria-valuenow="0">
          <div class="progress-fill" id="nb-fill"></div>
          <div class="progress-text" id="nb-ptext"></div>
        </div>

        <div class="nback-display" id="nb-display" role="status" aria-live="polite" aria-atomic="true">
          <span class="nback-number" id="nb-number">?</span>
        </div>

        <p class="nback-question" id="nb-question"></p>

        <div class="answer-buttons">
          <button type="button" class="btn btn-success answer-btn yes" id="nb-yes" disabled></button>
          <button type="button" class="btn btn-danger answer-btn no" id="nb-no" disabled></button>
        </div>

        <p class="feedback" id="nb-feedback" role="status" aria-live="assertive"></p>
        <p class="alert alert-info" id="nb-note" role="status" hidden></p>

        <div class="btn-group" style="justify-content:center">
          <button type="button" class="btn btn-secondary" id="nb-pause"></button>
          <button type="button" class="btn btn-secondary" id="nb-voice" hidden></button>
          <button type="button" class="btn btn-secondary" id="nb-end"></button>
        </div>
      </section>`;

    $("nb-yes").addEventListener("click", () => answer("yes"));
    $("nb-no").addEventListener("click", () => answer("no"));
    $("nb-end").addEventListener("click", confirmEnd);
    $("nb-pause").addEventListener("click", pauseGame);
    bindVoiceToggle($("nb-voice"));
    refreshPlayingTexts();
  }

  /** Update every text on the playing screen (also used when the language changes). */
  function refreshPlayingTexts() {
    $("nb-score").textContent = `${t("score")}: ${state.score}`;
    $("nb-level").textContent = t("nbackLevel", { n: engine.level });

    const shown = Math.min(state.round + 1, state.total);
    $("nb-ptext").textContent = t("roundsOf", { current: shown, total: state.total });
    $("nb-fill").style.width = `${(state.round / state.total) * 100}%`;
    $("nb-progress").setAttribute("aria-valuenow", String(state.round));

    $("nb-yes").textContent = t("yes");
    $("nb-no").textContent = t("no");
    $("nb-end").textContent = t("endGame");
    $("nb-pause").textContent = t("pauseGame");
    if (voice) $("nb-voice").textContent = voiceLabel();

    // 1-back: "Same as the last number?"   2/3-back: "...the number {n} steps ago?"
    const questionKey = engine.level === 1 ? "nbackQuestion1" : "nbackQuestion";
    $("nb-question").textContent = state.current?.warmup
      ? t("nbackRemember")
      : state.current
        ? t(questionKey, { n: engine.level })
        : "";

    const fb = $("nb-feedback");
    fb.className = `feedback ${state.feedback || ""}`.trim();
    fb.textContent = state.feedback ? t(state.feedback) : "";

    const note = $("nb-note");
    note.hidden = !state.note;
    note.textContent = state.note ? t(state.note.key, { n: state.note.n }) : "";
  }

  function startPlaying() {
    if (state.screen !== "intro") return;
    state.startedAt = Date.now();
    renderPlaying();
    nextRound();
  }

  function setAnswerButtons(enabled) {
    $("nb-yes").disabled = !enabled;
    $("nb-no").disabled = !enabled;
  }

  /** Show the next number. */
  function nextRound() {
    if (destroyed || state.screen !== "playing") return;

    state.feedback = null;
    state.note = null;
    const token = ++state.token;

    // The first n numbers have nothing to compare with = warm-up
    const warmup = state.history.length < engine.level;
    const pick = engine.nextNumber(state.history);
    state.history.push(pick.value);
    state.current = { value: pick.value, isMatch: pick.isMatch, warmup };

    $("nb-number").textContent = String(pick.value);
    $("nb-display").setAttribute("aria-label", String(pick.value));
    state.numberShownAt = performance.now();
    refreshPlayingTexts();

    // The number is hidden after the display time (answering is still allowed)
    later(() => {
      if (token === state.token) $("nb-number").textContent = "?";
    }, settings.displayMs);

    if (warmup) {
      setAnswerButtons(false);
      state.awaiting = false;
      later(() => {
        if (token === state.token) nextRound();
      }, settings.displayMs + WARMUP_GAP_MS);
    } else {
      setAnswerButtons(true);
      state.awaiting = true;
    }
  }

  /** The player pressed YES / NO (or said it). */
  function answer(choice) {
    if (!state.awaiting || state.screen !== "playing") return;
    state.awaiting = false;
    setAnswerButtons(false);

    const responseMs = performance.now() - state.numberShownAt;
    const correct = (choice === "yes") === state.current.isMatch;
    const levelBefore = engine.level;

    // Tell the AI engine, it decides if the level changes
    const result = engine.recordAnswer(correct, responseMs);

    if (correct) state.score += POINTS_PER_CORRECT * levelBefore;
    state.round++;
    state.feedback = correct ? "correct" : "wrong";
    state.note =
      result.change === "up"
        ? { key: "nbackLevelUp", n: result.level }
        : result.change === "down"
          ? { key: "nbackLevelDown", n: result.level }
          : null;

    refreshPlayingTexts();
    flash(correct);

    // Voice encouragement (FR015)
    const words = [correct ? t("voiceCorrect") : t("voiceWrong")];
    if (!correct && engine.level === 1) words.push(t("voiceHintNback"));
    if (state.note) words.push(t(state.note.key, { n: state.note.n }));
    speak(words.join(" "));

    later(() => {
      if (state.round >= state.total) finishGame(true);
      else nextRound();
    }, FEEDBACK_MS);
  }

  /** Green / red flash on the whole game panel. */
  function flash(correct) {
    const panel = $("nb-panel");
    panel.classList.remove("flash-correct", "flash-wrong");
    void panel.offsetWidth; // restart the animation
    panel.classList.add(correct ? "flash-correct" : "flash-wrong");
  }

  // ==========================================================
  // PRACTICE ROUND  (scripted 1-back example, no score, no saving)
  // ==========================================================
  function startPractice() {
    if (state.screen !== "intro") return;
    state.justPracticed = false;
    state.screen = "practice";
    practice = { i: 0, choice: null };
    container.innerHTML = `
      <section class="game-area" id="pr-panel" aria-labelledby="pr-title">
        <h2 id="pr-title"></h2>
        <p class="alert alert-info" id="pr-note"></p>
        <div class="nback-display" role="status" aria-live="polite" aria-atomic="true">
          <span class="nback-number" id="pr-number"></span>
        </div>
        <p class="nback-question" id="pr-question"></p>
        <div class="answer-buttons">
          <button type="button" class="btn btn-success answer-btn yes" id="pr-yes"></button>
          <button type="button" class="btn btn-danger answer-btn no" id="pr-no"></button>
        </div>
        <p class="feedback" id="pr-feedback" role="status" aria-live="assertive"></p>
        <p id="pr-why" role="status" aria-live="polite"></p>
        <div class="btn-group" style="justify-content:center">
          <button type="button" class="btn btn-large" id="pr-next"></button>
          <button type="button" class="btn btn-secondary" id="pr-skip"></button>
        </div>
      </section>`;
    $("pr-yes").addEventListener("click", () => practiceAnswer("yes"));
    $("pr-no").addEventListener("click", () => practiceAnswer("no"));
    $("pr-next").addEventListener("click", practiceNext);
    $("pr-skip").addEventListener("click", endPractice);
    refreshPractice();
  }

  /** Draw the current practice step (also used when the language changes). */
  function refreshPractice() {
    if (!practice) return;
    const i = practice.i;
    const value = PRACTICE_SEQUENCE[i];
    const previous = PRACTICE_SEQUENCE[i - 1];
    const isFirst = i === 0;
    const answered = practice.choice !== null;
    const isLast = i === PRACTICE_SEQUENCE.length - 1;

    $("pr-title").textContent = `${t("practiceTitle")} (${i + 1}/${PRACTICE_SEQUENCE.length})`;
    $("pr-note").textContent = t("practiceNote");
    $("pr-number").textContent = String(value);
    $("pr-yes").textContent = t("yes");
    $("pr-no").textContent = t("no");
    $("pr-skip").textContent = t("practiceSkip");
    $("pr-next").textContent = isLast ? t("finish") : t("next");

    // Remember-step: only "Next". Question-step: only YES / NO until answered.
    $("pr-yes").hidden = $("pr-no").hidden = isFirst;
    $("pr-yes").disabled = $("pr-no").disabled = answered;
    $("pr-next").hidden = !(isFirst || answered);
    $("pr-question").textContent = isFirst ? t("practiceRemember") : t("nbackQuestion1");

    const fb = $("pr-feedback");
    const why = $("pr-why");
    if (answered) {
      const isMatch = value === previous;
      const correct = (practice.choice === "yes") === isMatch;
      fb.className = `feedback ${correct ? "correct" : "wrong"}`;
      fb.textContent = t(correct ? "correct" : "wrong");
      why.textContent = t(isMatch ? "practiceSame" : "practiceDiff", { a: value, b: previous });
    } else {
      fb.className = "feedback";
      fb.textContent = "";
      why.textContent = "";
    }
    ($("pr-next").hidden ? $("pr-yes") : $("pr-next")).focus();
  }

  function practiceAnswer(choice) {
    if (state.screen !== "practice" || !practice) return;
    if (practice.i === 0 || practice.choice !== null) return;
    practice.choice = choice;
    refreshPractice();
    const isMatch = PRACTICE_SEQUENCE[practice.i] === PRACTICE_SEQUENCE[practice.i - 1];
    speak(`${t((choice === "yes") === isMatch ? "voiceCorrect" : "voiceWrong")} ${$("pr-why").textContent}`);
  }

  function practiceNext() {
    if (!practice) return;
    if (practice.i >= PRACTICE_SEQUENCE.length - 1) {
      state.justPracticed = true;
      markPracticed();
      endPractice();
      return;
    }
    practice.i++;
    practice.choice = null;
    refreshPractice();
  }

  /** Back to the intro screen (after finishing or skipping the practice). */
  function endPractice() {
    practice = null;
    renderIntro();
    $("nb-start").focus();
  }

  // ==========================================================
  // PAUSE
  // ==========================================================
  function pauseGame() {
    if (state.paused || state.screen !== "playing") return;
    if (container.querySelector(".modal-overlay")) return;

    state.paused = true;
    state.pauseStartedAt = Date.now();
    clearTimers();
    state.token++;                 // old timers can never act again

    // A number that was on screen without a finished answer is dropped,
    // so the player is never punished for pausing.
    const unanswered = state.awaiting || (state.current?.warmup && !state.feedback);
    if (unanswered) {
      state.history.pop();
      state.current = null;
    }
    state.awaiting = false;
    setAnswerButtons(false);
    $("nb-number").textContent = "?";

    const overlay = el("div", { className: "modal-overlay" });
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "nb-pause-title");
    const title = el("h2", { id: "nb-pause-title" });
    const text = el("p", { id: "nb-pause-text" });
    const resume = el("button", { type: "button", className: "btn btn-large", id: "nb-resume" });
    const box = el("div", { className: "modal-box" });
    box.append(title, text, resume);
    overlay.append(box);
    container.append(overlay);
    refreshPauseTexts();
    resume.focus();

    resume.addEventListener("click", resumeGame);
    overlay.addEventListener("keydown", (e) => e.key === "Escape" && resumeGame());
    speak(t("paused"));
  }

  function refreshPauseTexts() {
    if (!$("nb-pause-title")) return;
    $("nb-pause-title").textContent = t("paused");
    $("nb-pause-text").textContent = t("pausedText");
    $("nb-resume").textContent = t("resumeGame");
  }

  function resumeGame() {
    if (!state.paused) return;
    state.paused = false;
    state.pausedMs += Date.now() - state.pauseStartedAt;
    container.querySelector(".modal-overlay")?.remove();
    $("nb-pause")?.focus();

    // Carry on: finish the game if the last answer was already given
    if (state.round >= state.total) finishGame(true);
    else nextRound();
  }

  // ---------- ending early (with a confirmation box) ----------
  function confirmEnd() {
    if (container.querySelector(".modal-overlay")) return;

    const overlay = el("div", { className: "modal-overlay" });
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "nb-confirm-text");

    const message = el("p", { id: "nb-confirm-text" }, t("confirmEndGame"));
    const ok = el("button", { type: "button", className: "btn btn-danger" }, t("endGame"));
    const cancel = el("button", { type: "button", className: "btn btn-secondary" }, t("cancel"));
    const buttons = el("div", { className: "btn-group" });
    buttons.append(ok, cancel);
    const box = el("div", { className: "modal-box" });
    box.append(message, buttons);
    overlay.append(box);
    container.append(overlay);
    cancel.focus();

    const close = () => overlay.remove();
    cancel.addEventListener("click", close);
    overlay.addEventListener("keydown", (e) => e.key === "Escape" && close());
    ok.addEventListener("click", () => {
      close();
      endEarly();
    });
  }

  function endEarly() {
    clearTimers();
    state.awaiting = false;
    state.token++;
    if (state.round === 0) {
      // Nothing was answered, so there is nothing to save
      prepare();
    } else {
      finishGame(false);
    }
  }

  // ==========================================================
  // SCREEN 3: RESULT + SAVE   (FR016)
  // ==========================================================
  function finishGame(completed) {
    clearTimers();
    state.awaiting = false;
    engine.stop();
    voice?.stopListening?.();

    const stats = engine.getStats();
    state.summary = {
      accuracy: stats.accuracy,
      peakLabel: formatDifficulty("N-Back", stats.peakLevel),
      avgSeconds: (stats.averageResponseMs / 1000).toFixed(1),
    };
    state.payload = {
      gameType: "N-Back",
      score: state.score,
      difficultyLevel: formatDifficulty("N-Back", stats.peakLevel),
      duration: Math.max(0, Math.round((Date.now() - state.startedAt - state.pausedMs) / 1000)),
      completed,
    };

    renderResult();
    speak(t("voiceGameOver", { score: state.score }));
    doSave();
  }

  function renderResult() {
    state.screen = "result";
    container.innerHTML = `
      <section class="game-area result-panel card" aria-labelledby="nb-rtitle">
        <h2 id="nb-rtitle" tabindex="-1"></h2>
        <p class="result-score" id="nb-rscore"></p>
        <p id="nb-rlabel"></p>

        <div class="stats-grid">
          <div class="stat"><div class="stat-value" id="nb-racc"></div><div class="stat-label" id="nb-racc-l"></div></div>
          <div class="stat"><div class="stat-value" id="nb-rpeak"></div><div class="stat-label" id="nb-rpeak-l"></div></div>
          <div class="stat"><div class="stat-value" id="nb-ravg"></div><div class="stat-label" id="nb-ravg-l"></div></div>
        </div>

        <p id="nb-save" role="status" aria-live="polite"></p>

        <div class="btn-group" style="justify-content:center">
          <button type="button" class="btn btn-secondary btn-large" id="nb-retry" hidden></button>
          <button type="button" class="btn btn-large" id="nb-again"></button>
          <button type="button" class="btn btn-secondary btn-large" id="nb-back"></button>
        </div>
      </section>`;

    $("nb-retry").addEventListener("click", doSave);
    $("nb-again").addEventListener("click", prepare);
    $("nb-back").addEventListener("click", () => onExit?.());
    refreshResultTexts();
    $("nb-rtitle").focus();
  }

  function refreshResultTexts() {
    const s = state.summary;
    $("nb-rtitle").textContent = t("gameOver");
    $("nb-rscore").textContent = String(state.score);
    $("nb-rlabel").textContent = t("score");
    $("nb-racc").textContent = `${s.accuracy}%`;
    $("nb-racc-l").textContent = t("accuracy");
    $("nb-rpeak").textContent = s.peakLabel;
    $("nb-rpeak-l").textContent = t("peakLevel");
    $("nb-ravg").textContent = `${s.avgSeconds} ${t("seconds")}`;
    $("nb-ravg-l").textContent = t("avgAnswerTime");
    $("nb-again").textContent = t("playAgain");
    $("nb-back").textContent = t("back");
    $("nb-retry").textContent = t("tryAgain");
    showSaveStatus();
  }

  function showSaveStatus() {
    const box = $("nb-save");
    const retry = $("nb-retry");
    if (!box) return;
    retry.hidden = state.saveStatus !== "failed";
    if (state.saveStatus === "saving") {
      box.className = "alert alert-info";
      box.textContent = t("loading");
    } else if (state.saveStatus === "saved") {
      box.className = "alert alert-success";
      box.textContent = t("gameSaved");
    } else if (state.saveStatus === "failed") {
      box.className = "alert alert-error";
      box.textContent = t("gameSaveFailed");
    }
  }

  /** Save to Firestore. Safe to call again after a failure. */
  async function doSave() {
    state.saveStatus = "saving";
    showSaveStatus();
    const payloadAtStart = state.payload;
    try {
      await saveGameSession(profile.userId, payloadAtStart);
      if (destroyed || state.payload !== payloadAtStart) return;
      state.saveStatus = "saved";
    } catch (err) {
      console.error("N-Back: could not save the score:", err);
      if (destroyed || state.payload !== payloadAtStart) return;
      state.saveStatus = "failed";
    }
    showSaveStatus();
  }

  // ---------- language change (FR008) ----------
  function onLanguageChange() {
    if (destroyed || !engine) return;
    if (state.screen === "intro") fillIntroTexts();
    else if (state.screen === "practice") refreshPractice();
    else if (state.screen === "playing") {
      refreshPlayingTexts();
      refreshPauseTexts();
    }
    else if (state.screen === "result") refreshResultTexts();
  }
  window.addEventListener("languagechange", onLanguageChange);

  // ---------- start ----------
  (async () => {
    container.replaceChildren(el("p", { className: "loading", role: "status" }, t("loading")));
    await loadVoice();
    if (!destroyed) await prepare();
  })().catch((err) => {
    console.error("N-Back could not start:", err);
    if (destroyed) return;
    container.replaceChildren(el("div", { className: "alert alert-error", role: "alert" }, t("errGeneric")));
  });

  // ---------- cleanup, called by app.js when the player leaves ----------
  return function cleanup() {
    destroyed = true;
    clearTimers();
    window.removeEventListener("languagechange", onLanguageChange);
    engine?.stop();
    try {
      voice?.stopListening?.();
      voice?.destroy?.();
    } catch (err) {
      /* ignore */
    }
    container.replaceChildren();
  };
}