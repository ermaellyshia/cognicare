/**
 * ============================================================
 * CogniCare - js/welcome.js   (Increment 1: welcome screen)
 * ------------------------------------------------------------
 * Does two small things for welcome.html:
 *   1. Language buttons (BM / English) work and show which one is on.
 *   2. If the user is already logged in and ready (disclaimer
 *      accepted + category chosen), skip this page and go home.
 *
 * The disclaimer page and the category page do not exist yet, so for
 * now we only redirect when the user is fully ready ("home").
 * We add the other two redirects when those pages are built.
 * ============================================================
 */

import { applyTranslations, getLanguage, setLanguage } from "./translations.js";
import { getCurrentUserProfile, nextStepAfterLogin } from "./firebase-config.js";

// ------------------------------------------------------------
// 1. LANGUAGE BUTTONS
// ------------------------------------------------------------
const langButtons = document.querySelectorAll("[data-set-lang]");

/** aria-pressed="true" on the button of the current language. */
function markLanguageButtons() {
  const current = getLanguage();
  langButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.setLang === current));
  });
}

langButtons.forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.setLang));
});
window.addEventListener("languagechange", markLanguageButtons);

applyTranslations();
markLanguageButtons();

// ------------------------------------------------------------
// 2. ALREADY LOGGED IN?
// ------------------------------------------------------------
async function skipIfReady() {
  const user = await getCurrentUserProfile();
  if (!user) return; // not logged in: stay on this page

  if (nextStepAfterLogin(user) === "home") {
    // Elderly users play on the home page; caregivers and admins use the dashboard.
    location.replace(user.role === "elderly" ? "index.html" : "dashboard.html");
  }
  // "disclaimer" and "focus": pages are added in the next steps.
}

skipIfReady();