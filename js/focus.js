/**
 * ============================================================
 * CogniCare - js/focus.js   (Increment 1: "Where should we start?")
 * ------------------------------------------------------------
 * For focus.html:
 *   1. Only elderly users may see this page (requireAuth).
 *   2. Pressing a category button saves it in MySQL
 *      (PUT /api/me/focus) and goes to the home page.
 *   3. "Not sure" saves null. The AI suggests a category later.
 *
 * The language buttons are wired by auth.js (it starts itself on
 * every page that imports it).
 * ============================================================
 */

import { t } from "./translations.js";
import { requireAuth } from "./auth.js";
import { setFocusArea, friendlyAuthError } from "./firebase-config.js";

const buttons = document.querySelectorAll("[data-focus]");
const box = document.getElementById("form-message");

function showError(text) {
  box.className = "alert alert-error";
  box.textContent = text;
  box.hidden = false;
}

function setBusy(busy) {
  buttons.forEach((button) => {
    button.disabled = busy;
  });
}

async function start() {
  const me = await requireAuth(["elderly"]); // others go to their own page
  if (!me) return;

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      // "" (not sure) is saved as "unsure", so the user is not asked again
      const focusArea = button.dataset.focus || "unsure";
      box.hidden = true;
      setBusy(true);
      try {
        await setFocusArea(focusArea);
        window.location.replace("index.html"); // home (rebuilt later)
      } catch (err) {
        console.error("Could not save the category:", err);
        showError(t(friendlyAuthError(err).key));
        setBusy(false);
      }
    });
  });
}

start();