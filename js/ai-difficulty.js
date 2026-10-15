/**
 * ============================================================
 * CogniCare - ai-difficulty.js
 * ------------------------------------------------------------
 * AI adaptive difficulty engine.  FR014
 *
 * A RULE-BASED engine that follows reinforcement-learning ideas:
 *   - the "agent" is the engine, the "environment" is the player,
 *   - every answer is a REWARD signal (correct = +1, wrong = -1),
 *   - the "policy" is a set of simple rules that choose the next
 *     difficulty level (see below),
 *   - a smoothed performance score (moving average of the rewards)
 *     is kept so progress can be reported.
 *
 * RULES (from the project brief)
 *   N-Back   start 1-back (levels 1..3)
 *            3 correct in a row  -> level + 1
 *            2 wrong   in a row  -> level - 1
 *   Match-3  start 3x3 grid, 3 colours (grid 3..5)
 *            3 matches in a row  -> grid + 1  (also +1 colour)
 *            stuck for 30 seconds -> FIRST show a hint;
 *                                    if still stuck 30 s later -> grid - 1
 *
 * TWO "SMART" ADDITIONS (they make the engine adapt to the INDIVIDUAL)
 *   1. Response time + performance trend are used in the decision:
 *        - a correct answer that took too long ("hesitant") is still
 *          correct for the score, but it only earns HALF a reward and
 *          does not count towards "3 correct in a row"
 *        - before the level goes UP, the recent performance trend must
 *          be good (moving average of rewards). If the player has been
 *          struggling, the engine waits for one more correct answer
 *          to be sure. The streak is kept, not reset.
 *   2. Personal starting level: a returning player starts at the level
 *      they usually reach (median of their last sessions), instead of
 *      always 1-back / 3x3. New players still start at the minimum,
 *      exactly as in the brief.
 *
 * TRACKED PERFORMANCE
 *   correct streak, wrong streak, total correct, total wrong,
 *   average response time (+ peak level, accuracy, adaptation log)
 *
 * HOW A GAME USES IT
 *   import { loadEngineConfig, getPersonalStartLevel, createEngine, formatDifficulty }
 *     from "./ai-difficulty.js";
 *
 *   const config = await loadEngineConfig();        // admin settings (FR023)
 *   const start  = await getPersonalStartLevel(userId, "N-Back");
 *   const engine = createEngine("N-Back", config, { startLevel: start.level });
 *                                                   // or "Match-3"
 *
 *   // N-Back, after each answer:
 *   const r = engine.recordAnswer(isCorrect, responseTimeMs);
 *   if (r.change === "up")   ...   // r.level is the NEW level
 *   if (r.change === "down") ...
 *
 *   // Match-3: see Match3Engine below (recordMatch, recordInvalidMove,
 *   // startStuckWatch).
 *
 *   // When the game ends:
 *   const stats = engine.getStats();
 *   saveGameSession(userId, {
 *     gameType: "N-Back",
 *     score,
 *     difficultyLevel: formatDifficulty("N-Back", stats.peakLevel),
 *     duration,
 *   });
 *
 * This file does not touch the page, so the same code can be tested
 * with plain JavaScript (see the checklist at the bottom).
 * ============================================================
 */

// ------------------------------------------------------------
// 1. SETTINGS
// ------------------------------------------------------------

/** Defaults = the numbers in the project brief. */
export const DEFAULT_ENGINE_CONFIG = {
  nBackIncreaseStreak: 3,   // correct in a row -> harder
  nBackDecreaseStreak: 2,   // wrong in a row   -> easier
  match3IncreaseStreak: 3,  // matches in a row -> bigger grid
  match3StuckSeconds: 30,   // seconds without a match = "stuck"
  nBackSlowResponseMs: 6000,   // a correct N-Back answer slower than this = "hesitant"
  match3SlowResponseMs: 20000, // a valid Match-3 move slower than this = "hesitant"
};

/**
 * Read the settings the administrator saved (FR023) from Firestore.
 * If Firestore cannot be reached, the defaults are used so the game
 * always still works.
 */
export async function loadEngineConfig() {
  try {
    // Imported here (not at the top) so this file also runs without a
    // network connection, e.g. in a simple test.
    const { getSystemConfig } = await import("./firebase-config.js");
    const saved = await getSystemConfig();
    const config = { ...DEFAULT_ENGINE_CONFIG };
    for (const key of Object.keys(DEFAULT_ENGINE_CONFIG)) {
      const value = Number(saved[key]);
      if (Number.isFinite(value) && value > 0) config[key] = value;
    }
    return config;
  } catch (err) {
    console.warn("Using default difficulty settings:", err.message);
    return { ...DEFAULT_ENGINE_CONFIG };
  }
}

/**
 * Text saved with each game session (the "difficultyLevel" field).
 *   N-Back  level 2 -> "2-back"
 *   Match-3 level 4 -> "4x4"
 */
export function formatDifficulty(gameType, level) {
  return gameType === "Match-3" ? `${level}x${level}` : `${level}-back`;
}

/**
 * Turn a saved difficulty text back into a number.
 *   "2-back" -> 2     "4x4" -> 4     anything else -> null
 */
export function parseDifficulty(gameType, text) {
  const value = String(text ?? "").trim();
  const match =
    gameType === "Match-3" ? value.match(/^(\d)x\1$/) : value.match(/^(\d)-back$/);
  return match ? Number(match[1]) : null;
}

/**
 * Personal starting level (pure function, easy to test).
 *
 * RULE: a player with fewer than 2 finished sessions of this game starts at
 * the minimum level (1-back / 3x3), as in the brief. Otherwise the start is
 * the MEDIAN of the peak levels of their last 3 sessions. The median ignores
 * one lucky or unlucky game.
 *
 * @param {"N-Back"|"Match-3"} gameType
 * @param {Array<{gameType:string, difficultyLevel:string, completed?:boolean}>} sessions
 *        the user's sessions, oldest first (what getUserSessions() returns)
 * @returns {{level:number, personalised:boolean}}
 */
export function getStartLevel(gameType, sessions = []) {
  const [min, max] = gameType === "Match-3" ? [3, 5] : [1, 3];

  const peaks = sessions
    .filter((s) => s.gameType === gameType && s.completed !== false)
    .map((s) => parseDifficulty(gameType, s.difficultyLevel))
    .filter((n) => n !== null && n >= min && n <= max)
    .slice(-3);

  if (peaks.length < 2) return { level: min, personalised: false };

  const sorted = [...peaks].sort((a, b) => a - b);
  const median =
    sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : Math.floor((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);

  return { level: median, personalised: median > min };
}

/**
 * Read the user's past sessions from Firestore and work out their start
 * level. If anything goes wrong (offline, no data) it returns the minimum
 * level, so the game always starts.
 *
 *   const start = await getPersonalStartLevel(profile.userId, "N-Back");
 *   const engine = createEngine("N-Back", config, { startLevel: start.level });
 */
export async function getPersonalStartLevel(userId, gameType) {
  try {
    const { getUserSessions } = await import("./firebase-config.js");
    const sessions = await getUserSessions(userId, gameType);
    return getStartLevel(gameType, sessions);
  } catch (err) {
    console.warn("Using the default start level:", err.message);
    return getStartLevel(gameType, []);
  }
}

// ------------------------------------------------------------
// 2. BASE ENGINE  (shared by both games)
// ------------------------------------------------------------

export class AdaptiveEngine {
  /**
   * @param {object} options
   * @param {string} options.gameType         "N-Back" | "Match-3"
   * @param {number} options.minLevel
   * @param {number} options.maxLevel
   * @param {number} [options.startLevel]     defaults to minLevel
   * @param {number} options.increaseStreak   correct in a row to go up
   * @param {number} options.decreaseStreak   wrong in a row to go down
   *                                          (Infinity = never by wrong answers)
   * @param {number|null} [options.slowResponseMs]  a correct answer slower than
   *                                          this is "hesitant" (null = ignore time)
   * @param {boolean} [options.smart=true]    false = the plain rules of the brief only
   */
  constructor({
    gameType, minLevel, maxLevel, startLevel, increaseStreak, decreaseStreak,
    slowResponseMs = null, smart = true,
  }) {
    this.gameType = gameType;
    this.minLevel = minLevel;
    this.maxLevel = maxLevel;
    this.increaseStreak = increaseStreak;
    this.decreaseStreak = decreaseStreak;

    this.level = Math.max(minLevel, Math.min(maxLevel, startLevel ?? minLevel));
    this.startLevel = this.level;
    this.peakLevel = this.level;
    this.slowResponseMs = slowResponseMs;
    this.smart = smart;

    // --- Tracked performance (required by the brief) ---
    this.correctStreak = 0;
    this.wrongStreak = 0;
    this.totalCorrect = 0;
    this.totalWrong = 0;
    this._responseTimeSum = 0;
    this._responseTimeCount = 0;

    // --- Reinforcement-learning style bookkeeping ---
    // Moving average of the reward (+1 / -1). Range -1..+1.
    // 0 = even, +1 = always right, -1 = always wrong.
    this.performance = 0;
    this._learningRate = 0.2;      // how fast the average follows new answers

    // Level goes UP only if the trend is at least this good. It is lowered
    // for short streaks so that `increaseStreak` straight correct answers
    // from a fresh start ALWAYS pass (average after k correct = 1-0.8^k).
    this.performanceGate = Number.isFinite(increaseStreak)
      ? Math.min(0.3, 1 - Math.pow(1 - this._learningRate, increaseStreak) - 0.1)
      : 0.3;
    this.hesitantCount = 0;        // correct answers that were too slow

    // Every level change is logged (useful evidence for the report)
    this.adaptations = [];
    this._answerNumber = 0;
  }

  /**
   * Tell the engine the result of ONE answer / move.
   *
   * @param {boolean} correct
   * @param {number|null} [responseTimeMs]  how long the player took
   * @returns {{change:"up"|"down"|"none", level:number, previousLevel:number,
   *            atLimit:null|"max"|"min", held:null|"performance",
   *            hesitant:boolean, correctStreak:number, wrongStreak:number}}
   */
  recordAnswer(correct, responseTimeMs = null) {
    this._answerNumber++;
    const previousLevel = this.level;

    // A correct answer that took too long is "hesitant"
    const hesitant =
      correct &&
      this.smart &&
      this.slowResponseMs !== null &&
      Number.isFinite(responseTimeMs) &&
      responseTimeMs > this.slowResponseMs;

    // 1) Update the counters
    if (correct) {
      this.totalCorrect++;
      this.wrongStreak = 0;
      if (hesitant) this.hesitantCount++;   // streak is held: no +1, no reset
      else this.correctStreak++;
    } else {
      this.totalWrong++;
      this.wrongStreak++;
      this.correctStreak = 0;
    }
    if (Number.isFinite(responseTimeMs) && responseTimeMs >= 0) {
      this._responseTimeSum += responseTimeMs;
      this._responseTimeCount++;
    }

    // 2) Reward signal -> moving average
    //    correct = +1, hesitant correct = +0.5, wrong = -1
    const reward = correct ? (hesitant ? 0.5 : 1) : -1;
    this.performance += this._learningRate * (reward - this.performance);

    // 3) Policy: decide whether the level changes
    let change = "none";
    let atLimit = null;
    let held = null;

    if (this.correctStreak >= this.increaseStreak) {
      if (this.level < this.maxLevel) {
        if (this.smart && this.performance < this.performanceGate) {
          // The player has been struggling lately: wait for one more
          // correct answer. The streak is kept, so the next one re-checks.
          held = "performance";
          return this._result("none", previousLevel, null, held, hesitant);
        }
        this._setLevel(this.level + 1, "correct-streak");
        change = "up";
      } else {
        atLimit = "max";          // already at the hardest level
      }
      this.correctStreak = 0;     // start counting again
    } else if (this.wrongStreak >= this.decreaseStreak) {
      if (this.level > this.minLevel) {
        this._setLevel(this.level - 1, "wrong-streak");
        change = "down";
      } else {
        atLimit = "min";          // already at the easiest level
      }
      this.wrongStreak = 0;
    }

    // A level change gives a clean start for the new level
    if (change !== "none") {
      this.correctStreak = 0;
      this.wrongStreak = 0;
    }

    return this._result(change, previousLevel, atLimit, held, hesitant);
  }

  /** Build the object that recordAnswer() returns. */
  _result(change, previousLevel, atLimit, held, hesitant) {
    return {
      change,
      level: this.level,
      previousLevel,
      atLimit,
      held,
      hesitant,
      correctStreak: this.correctStreak,
      wrongStreak: this.wrongStreak,
    };
  }

  /** Change the level and write it in the adaptation log. */
  _setLevel(newLevel, reason) {
    const from = this.level;
    this.level = Math.max(this.minLevel, Math.min(this.maxLevel, newLevel));
    this.peakLevel = Math.max(this.peakLevel, this.level);
    this.adaptations.push({
      answerNumber: this._answerNumber,
      from,
      to: this.level,
      reason,
    });
  }

  /** Average response time in milliseconds (0 if nothing recorded). */
  get averageResponseMs() {
    return this._responseTimeCount
      ? Math.round(this._responseTimeSum / this._responseTimeCount)
      : 0;
  }

  /** Percentage of correct answers (0-100). */
  get accuracy() {
    const total = this.totalCorrect + this.totalWrong;
    return total ? Math.round((this.totalCorrect / total) * 100) : 0;
  }

  /** A snapshot of everything the engine knows. */
  getStats() {
    return {
      gameType: this.gameType,
      level: this.level,
      startLevel: this.startLevel,
      peakLevel: this.peakLevel,
      hesitantAnswers: this.hesitantCount,
      correctStreak: this.correctStreak,
      wrongStreak: this.wrongStreak,
      totalCorrect: this.totalCorrect,
      totalWrong: this.totalWrong,
      accuracy: this.accuracy,
      averageResponseMs: this.averageResponseMs,
      performance: Math.round(this.performance * 100) / 100,
      adaptations: this.adaptations.map((a) => ({ ...a })),
    };
  }

  /** Called when the game ends or restarts. Subclasses add their own cleanup. */
  stop() {}
}

// ------------------------------------------------------------
// 3. N-BACK ENGINE
// ------------------------------------------------------------

export class NBackEngine extends AdaptiveEngine {
  /**
   * @param {object} config            from loadEngineConfig()
   * @param {object} [options]
   * @param {number} [options.startLevel=1]   from getPersonalStartLevel()
   * @param {boolean} [options.smart=true]    false = plain rules only
   */
  constructor(config = DEFAULT_ENGINE_CONFIG, options = {}) {
    super({
      gameType: "N-Back",
      minLevel: 1,
      maxLevel: 3,
      startLevel: options.startLevel ?? 1,           // brief: start at 1-back
      increaseStreak: config.nBackIncreaseStreak,    // 3 correct in a row
      decreaseStreak: config.nBackDecreaseStreak,    // 2 wrong in a row
      slowResponseMs: config.nBackSlowResponseMs ?? DEFAULT_ENGINE_CONFIG.nBackSlowResponseMs,
      smart: options.smart !== false,
    });
  }

  /** "2-back" style label for the screen and for saving. */
  get label() {
    return formatDifficulty("N-Back", this.level);
  }

  /**
   * Which number should be shown next?
   *
   * A purely random 1-9 number matches the one n steps ago only about
   * 11% of the time, which makes the game too easy to answer "NO" all
   * the time. So about 35% of the time we deliberately repeat the number
   * from n steps ago (a "target"), which keeps the YES/NO answers
   * balanced.
   *
   * @param {number[]} history   numbers shown so far (oldest first)
   * @returns {{value:number, isMatch:boolean}}
   */
  nextNumber(history, matchChance = 0.35) {
    const n = this.level;
    const target = history.length >= n ? history[history.length - n] : null;

    if (target !== null && Math.random() < matchChance) {
      return { value: target, isMatch: true };
    }

    // Pick any number EXCEPT the target, so it is a real "NO" answer
    let value;
    do {
      value = 1 + Math.floor(Math.random() * 9);
    } while (value === target);
    return { value, isMatch: false };
  }
}

// ------------------------------------------------------------
// 4. MATCH-3 ENGINE
// ------------------------------------------------------------

export class Match3Engine extends AdaptiveEngine {
  /**
   * @param {object} config            from loadEngineConfig()
   * @param {object} [options]
   * @param {number} [options.startLevel=3]   grid size from getPersonalStartLevel()
   * @param {boolean} [options.smart=true]    false = plain rules only
   */
  constructor(config = DEFAULT_ENGINE_CONFIG, options = {}) {
    super({
      gameType: "Match-3",
      minLevel: 3,                                   // grid 3x3
      maxLevel: 5,                                   // grid 5x5
      startLevel: options.startLevel ?? 3,           // brief: start at 3x3
      increaseStreak: config.match3IncreaseStreak,   // 3 matches in a row
      decreaseStreak: Infinity,                      // wrong swaps never lower the grid
      slowResponseMs: config.match3SlowResponseMs ?? DEFAULT_ENGINE_CONFIG.match3SlowResponseMs,
      smart: options.smart !== false,
    });
    this.stuckSeconds = config.match3StuckSeconds;   // 30
    this.stuckCount = 0;                             // "stuck" events at this level
    this._timer = null;
    this._onStuck = null;
  }

  /** Grid size = level (3, 4 or 5). */
  get gridSize() {
    return this.level;
  }

  /** "4x4" style label for the screen and for saving. */
  get label() {
    return formatDifficulty("Match-3", this.level);
  }

  /** Number of tile colours: 3 on 3x3, 4 on 4x4, 5 on 5x5. */
  get colorCount() {
    return this.level;
  }

  /** The player made a valid match (counts as "correct"). */
  recordMatch(responseTimeMs = null) {
    this.stuckCount = 0;                // moving again, forget being stuck
    const result = this.recordAnswer(true, responseTimeMs);
    if (result.change !== "none") this.stuckCount = 0;
    this.resetStuckWatch();             // restart the 30-second countdown
    return result;
  }

  /** The player tried a swap that did not make a match. */
  recordInvalidMove(responseTimeMs = null) {
    return this.recordAnswer(false, responseTimeMs);
  }

  /**
   * The player has been stuck for `stuckSeconds`.
   *  - 1st time at this level -> show a hint
   *  - still stuck afterwards -> make the grid smaller (if possible)
   *
   * @returns {{action:"hint"|"down", level:number, previousLevel:number}}
   */
  recordStuck() {
    const previousLevel = this.level;
    this.stuckCount++;

    if (this.stuckCount >= 2 && this.level > this.minLevel) {
      this._setLevel(this.level - 1, "stuck");
      this.correctStreak = 0;
      this.wrongStreak = 0;
      this.stuckCount = 0;
      return { action: "down", level: this.level, previousLevel };
    }
    // First time, or already at the smallest grid: just help with a hint
    return { action: "hint", level: this.level, previousLevel };
  }

  // ----- 30-second "stuck" countdown -----

  /**
   * Start watching for a stuck player.
   * `onStuck(result)` is called every `stuckSeconds` of no valid match,
   * where result = the object returned by recordStuck().
   */
  startStuckWatch(onStuck) {
    this._onStuck = onStuck;
    this.resetStuckWatch();
  }

  /** Restart the countdown (called automatically after every valid match). */
  resetStuckWatch() {
    clearTimeout(this._timer);
    if (!this._onStuck) return;
    this._timer = setTimeout(() => {
      const result = this.recordStuck();
      this._onStuck?.(result);
      this.resetStuckWatch();           // keep watching
    }, this.stuckSeconds * 1000);
  }

  /** Pause the countdown (e.g. while a dialog is open). */
  pauseStuckWatch() {
    clearTimeout(this._timer);
  }

  /** Stop completely (game ended or player left the game). */
  stop() {
    clearTimeout(this._timer);
    this._timer = null;
    this._onStuck = null;
  }
}

// ------------------------------------------------------------
// 5. FACTORY
// ------------------------------------------------------------

/**
 * Create the right engine for a game.
 * @param {"N-Back"|"Match-3"} gameType
 * @param {object} [config]   from loadEngineConfig()
 * @param {object} [options]  { startLevel, smart } - see the engine classes
 */
export function createEngine(gameType, config = DEFAULT_ENGINE_CONFIG, options = {}) {
  if (gameType === "N-Back") return new NBackEngine(config, options);
  if (gameType === "Match-3") return new Match3Engine(config, options);
  throw new Error(`Unknown game type: ${gameType}`);
}

/*
 * ------------------------------------------------------------
 * TEST CHECKLIST (what this file must do)  - useful for your report
 *
 *  N-Back
 *   [ ] starts at 1-back
 *   [ ] 3 correct in a row at 1-back  -> 2-back
 *   [ ] 3 correct in a row at 3-back  -> stays 3-back (atLimit "max")
 *   [ ] 2 wrong in a row at 3-back    -> 2-back
 *   [ ] 2 wrong in a row at 1-back    -> stays 1-back (atLimit "min")
 *   [ ] correct, wrong, correct       -> no change (streaks reset)
 *   [ ] nextNumber() gives about 35% matches, never a fake match
 *
 *  Match-3
 *   [ ] starts at 3x3, 3 colours
 *   [ ] 3 matches in a row            -> 4x4, 4 colours
 *   [ ] wrong swaps never lower the grid
 *   [ ] 30 s stuck (1st)              -> hint
 *   [ ] 30 s stuck (2nd)              -> grid - 1
 *   [ ] a valid match resets the stuck counter and the countdown
 *
 *  Smart additions
 *   [ ] a correct answer slower than the limit does not count towards the streak
 *   [ ] a hesitant answer still counts as correct in the totals
 *   [ ] after a poor run, level-up waits for one more correct answer
 *   [ ] 3 straight correct answers from a fresh start ALWAYS level up
 *   [ ] new player starts at 1-back / 3x3; returning player at their median peak
 *   [ ] { smart: false } gives exactly the plain rules of the brief
 *
 *  Statistics
 *   [ ] totals, accuracy and average response time are correct
 *   [ ] every level change appears in stats.adaptations
 * ------------------------------------------------------------
 */