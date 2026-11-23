/**
 * ============================================================
 * CogniCare - js/disclaimer.js   (Increment 1: mandatory disclaimer)
 * ------------------------------------------------------------
 * For disclaimer.html:
 *   1. Only logged-in users may see this page (requireAuth).
 *   2. Already accepted before? Skip straight to the next step.
 *   3. The Continue button works only after the box is ticked.
 *   4. Continue saves the date in MySQL (PUT /api/me/consent),
 *      then goes to the next step.
 *
 * The language buttons are wired by auth.js (it starts itself on
 * every page that imports it), so nothing about language is here.
 * ============================================================
 */

import { t } from "./translations.js";
import { requireAuth } from "./auth.js";
import { acceptDisclaimer, nextStepAfterLogin, friendlyAuthError } from "./firebase-config.js";

const agree = document.getElementById("agree");
const continueBtn = document.getElementById("continue-btn");
const box = document.getElementById("form-message");


function pageFor(user) {
  const step = nextStepAfterLogin(user);
  if (step === "focus") return "focus.html";
  if (step === "home") return user.role === "elderly" ? "index.html" : "dashboard.html";
  return "disclaimer.html"; // "disclaimer": stay here
}

function showError(text) {
  box.className = "alert alert-error";
  box.textContent = text;
  box.hidden = false;
}

async function start() {
  const me = await requireAuth(); // not logged in -> sent to login.html
  if (!me) return;

  // Accepted before: nothing to do here.
  if (me.disclaimerAcceptedAt) {
    window.location.replace(pageFor(me));
    return;
  }

  // The button is on only while the box is ticked.
  agree.addEventListener("change", () => {
    continueBtn.disabled = !agree.checked;
  });

  continueBtn.addEventListener("click", async () => {
    if (!agree.checked) return;
    box.hidden = true;
    continueBtn.disabled = true;
    continueBtn.textContent = t("loading");
    try {
      const user = await acceptDisclaimer();
      window.location.replace(pageFor(user));
    } catch (err) {
      console.error("Could not save the disclaimer:", err);
      showError(t(friendlyAuthError(err).key));
      continueBtn.textContent = t("disclaimerContinue");
      continueBtn.disabled = !agree.checked;
    }
  });
}

start();