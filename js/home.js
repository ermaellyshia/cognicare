/**
 * ============================================================
 * CogniCare - js/home.js   (Increment 1: Home / "Utama")
 * ------------------------------------------------------------
 * For index.html:
 *   1. Only elderly users may see this page (requireAuth). It also
 *      sends users who have not accepted the disclaimer to it first.
 *   2. Greeting that follows the time of day, with the first name.
 *   3. Today's suggestion. For now it is a simple rule:
 *        - the category the user chose  -> suggest that one
 *        - "not sure" / nothing chosen  -> suggest Memory (gentle start)
 *      Later the AI recommender (/api/recommend) replaces this rule
 *      with a suggestion based on the user's own results.
 *
 * Language buttons and translations are handled by auth.js.
 * ============================================================
 */

import { t } from "./translations.js";
import { requireAuth } from "./auth.js";

const CATEGORY_KEY = {
  memory: "catMemory",
  attention: "catAttention",
  speed: "catSpeed",
};
const DEFAULT_SUGGESTION = "memory";

/** 05:00-11:59 morning, 12:00-14:59 afternoon, otherwise evening. */
function greetingKey(hour) {
  if (hour >= 5 && hour < 12) return "greetingMorning";
  if (hour >= 12 && hour < 15) return "greetingAfternoon";
  return "greetingEvening";
}

function suggestedCategory(user) {
  return CATEGORY_KEY[user.focusArea] ? user.focusArea : DEFAULT_SUGGESTION;
}

/** Fill the greeting and the suggestion (called again when the language changes). */
function render(user) {
  const firstName = String(user.name || "").trim().split(/\s+/)[0];
  document.getElementById("greeting").textContent = t(greetingKey(new Date().getHours()), {
    name: firstName,
  });

  const category = t(CATEGORY_KEY[suggestedCategory(user)]);
  document.getElementById("suggestion-text").textContent = t("suggestionTry", { category });
}

async function start() {
  const me = await requireAuth(["elderly"]); // others go to their own page
  if (!me) return;

  render(me);
  window.addEventListener("languagechange", () => render(me));
}

start();