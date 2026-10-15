/**
 * ============================================================
 * CogniCare - auth.js
 * ------------------------------------------------------------
 * Login, register, reset password, logout and page protection.
 * FR001 (login), FR002 (create account), FR005 (reset password)
 *
 * TWO WAYS THIS FILE IS USED
 *  1. On login.html and register.html:
 *       <script type="module" src="js/auth.js"></script>
 *     The forms are wired up automatically (see the IDs below).
 *  2. On every other page, import what you need, e.g.:
 *       import { requireAuth, setupLogoutButtons } from "./auth.js";
 *       const me = await requireAuth(["elderly"]);   // null = being redirected
 *
 * HTML IDs THIS FILE EXPECTS
 *  login.html
 *    form#login-form          (add the attribute "novalidate")
 *    input#email, input#password[data-password]
 *    input#show-password      (checkbox)
 *    button#login-btn         (type="submit", has data-i18n="login")
 *    div#form-message         (role="alert", hidden)
 *    button#forgot-link       opens the reset section
 *    section#reset-section[hidden] containing:
 *        input#reset-email, button#reset-btn, button#reset-cancel
 *    [data-set-lang="bm"|"en"] language buttons (optional)
 *  register.html
 *    form#register-form       (add the attribute "novalidate")
 *    input#name, #email, #age, #password[data-password],
 *    #confirm-password[data-password]
 *    radio inputs name="role" with value "elderly" / "caregiver"
 *    input#show-password, button#register-btn, div#form-message
 *
 * SECURITY NOTE: the "admin" role is NOT offered on the register page
 * and is rejected here. Create admins by changing the "role" field of
 * a registered user to "admin" in Firebase Console -> Firestore.
 * ============================================================
 */

import {
  loginUser,
  registerUser,
  logoutUser,
  resetPassword,
  friendlyAuthError,
  getCurrentUserProfile,
} from "./firebase-config.js";
import { t, setLanguage, getLanguage, applyTranslations } from "./translations.js";

// ------------------------------------------------------------
// 1. DISPLAY PREFERENCES (font size, high contrast, language)
//    Saved in localStorage too, so the page looks right
//    immediately, before Firebase has answered. (FR008-FR010)
// ------------------------------------------------------------
const PREF_FONT = "cognicare_font";
const PREF_CONTRAST = "cognicare_contrast";
const VALID_FONTS = ["small", "medium", "large", "extra-large"];
const DEFAULT_FONT = "large";

/** Put the font size / contrast onto <html>. style.css does the rest. */
export function applyDisplayPreferences(fontSize, highContrast) {
  const root = document.documentElement;
  root.dataset.font = VALID_FONTS.includes(fontSize) ? fontSize : DEFAULT_FONT;
  if (highContrast) root.dataset.contrast = "high";
  else delete root.dataset.contrast;
}

/** Apply the last saved preferences (runs instantly, no network). */
export function applySavedPreferences() {
  let font = DEFAULT_FONT;
  let contrast = false;
  try {
    font = localStorage.getItem(PREF_FONT) || DEFAULT_FONT;
    contrast = localStorage.getItem(PREF_CONTRAST) === "true";
  } catch (err) {
    /* storage blocked - use defaults */
  }
  applyDisplayPreferences(font, contrast);
}

/**
 * Apply the preferences stored in a user's Firebase profile
 * and remember them on this device.
 */
export function applyUserPreferences(profile) {
  if (!profile) return;
  applyDisplayPreferences(profile.fontSize, profile.highContrastMode);
  try {
    localStorage.setItem(PREF_FONT, profile.fontSize || DEFAULT_FONT);
    localStorage.setItem(PREF_CONTRAST, String(Boolean(profile.highContrastMode)));
  } catch (err) {
    /* ignore */
  }
  if (profile.languagePreference && profile.languagePreference !== getLanguage()) {
    setLanguage(profile.languagePreference);
  }
}

// Run straight away so every page that imports this file looks correct.
applySavedPreferences();

// ------------------------------------------------------------
// 2. SMALL HELPERS
// ------------------------------------------------------------

/** Where each role starts after login. */
export function getHomePageForRole(role) {
  return role === "elderly" ? "index.html" : "dashboard.html";
}

/**
 * "Flash" message that survives one page change, e.g. redirected to
 * login with "please log in first". Stores a translation KEY.
 */
const FLASH_KEY = "cognicare_flash";

export function setFlash(translationKey) {
  try {
    sessionStorage.setItem(FLASH_KEY, translationKey);
  } catch (err) {
    /* ignore */
  }
}

/** Read and clear the flash message. Returns translated text or null. */
export function consumeFlash() {
  try {
    const key = sessionStorage.getItem(FLASH_KEY);
    sessionStorage.removeItem(FLASH_KEY);
    return key ? t(key) : null;
  } catch (err) {
    return null;
  }
}

/** Show a message in the #form-message box (icon comes from CSS). */
function showMessage(box, text, type = "error") {
  if (!box) return;
  box.className = `alert alert-${type}`;
  box.textContent = text;
  box.hidden = false;
}

function clearMessage(box) {
  if (!box) return;
  box.hidden = true;
  box.textContent = "";
}

/** Mark fields valid/invalid for screen readers and CSS. */
function setInvalid(input, invalid) {
  if (!input) return;
  if (invalid) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

/**
 * Disable a button and show "Please wait..." while we talk to Firebase.
 * This also stops accidental double taps. Returns a function that
 * restores the button.
 */
function setBusy(button) {
  if (!button) return () => {};
  button.disabled = true;
  button.textContent = t("loading");
  return () => {
    button.disabled = false;
    button.textContent = t(button.dataset.i18n || "login");
  };
}

/** Basic email shape check (Firebase does the final check). */
function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Show/hide password: one checkbox controls every password box. */
function setupShowPassword() {
  const toggle = document.getElementById("show-password");
  if (!toggle) return;
  toggle.addEventListener("change", () => {
    document.querySelectorAll("input[data-password]").forEach((input) => {
      input.type = toggle.checked ? "text" : "password";
    });
  });
}

/** Language buttons (needed before login, because nothing is saved yet). */
function setupLanguageButtons() {
  const buttons = document.querySelectorAll("[data-set-lang]");
  const refresh = () =>
    buttons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.setLang === getLanguage()))
    );
  buttons.forEach((btn) =>
    btn.addEventListener("click", () => {
      setLanguage(btn.dataset.setLang);
      applyTranslations();
      refresh();
    })
  );
  refresh();
}

// ------------------------------------------------------------
// 3. LOGIN PAGE  (FR001, FR005)
// ------------------------------------------------------------
async function initLoginPage(form) {
  form.noValidate = true; // we show our own translated messages
  const box = document.getElementById("form-message");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("login-btn");

  // Already logged in? Go straight to the right page.
  const existing = await getCurrentUserProfile();
  if (existing) {
    applyUserPreferences(existing);
    window.location.replace(getHomePageForRole(existing.role));
    return;
  }

  // Message from a page guard, e.g. "Please log in first."
  const flash = consumeFlash();
  if (flash) showMessage(box, flash, "info");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage(box);

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Check empty fields
    setInvalid(emailInput, !email);
    setInvalid(passwordInput, !password);
    if (!email || !password) {
      showMessage(box, t("fieldRequired"));
      (!email ? emailInput : passwordInput).focus();
      return;
    }
    if (!looksLikeEmail(email)) {
      setInvalid(emailInput, true);
      showMessage(box, t("errInvalidEmail"));
      emailInput.focus();
      return;
    }

    const restore = setBusy(loginBtn);
    try {
      const profile = await loginUser(email, password);
      applyUserPreferences(profile);
      window.location.replace(getHomePageForRole(profile.role));
    } catch (err) {
      console.error("Login failed:", err);
      showMessage(box, t(friendlyAuthError(err).key));
      restore();
    }
  });

  initResetSection(box, emailInput);
}

/** Forgot-password section on the login page (FR005). */
function initResetSection(box, loginEmailInput) {
  const forgotLink = document.getElementById("forgot-link");
  const section = document.getElementById("reset-section");
  if (!forgotLink || !section) return;

  const resetEmail = document.getElementById("reset-email");
  const resetBtn = document.getElementById("reset-btn");
  const cancelBtn = document.getElementById("reset-cancel");

  forgotLink.addEventListener("click", () => {
    clearMessage(box);
    section.hidden = false;
    resetEmail.value = loginEmailInput?.value.trim() || ""; // save retyping
    resetEmail.focus();
  });

  cancelBtn?.addEventListener("click", () => {
    section.hidden = true;
    clearMessage(box);
    forgotLink.focus();
  });

  resetBtn.addEventListener("click", async () => {
    clearMessage(box);
    const email = resetEmail.value.trim();
    if (!looksLikeEmail(email)) {
      setInvalid(resetEmail, true);
      showMessage(box, t("errInvalidEmail"));
      resetEmail.focus();
      return;
    }
    setInvalid(resetEmail, false);

    const restore = setBusy(resetBtn);
    try {
      await resetPassword(email);
      showMessage(box, t("resetLinkSent"), "success");
    } catch (err) {
      console.error("Reset failed:", err);
      showMessage(box, t(friendlyAuthError(err).key));
    }
    restore();
  });
}

// ------------------------------------------------------------
// 4. REGISTER PAGE  (FR002)
// ------------------------------------------------------------
async function initRegisterPage(form) {
  form.noValidate = true;
  const box = document.getElementById("form-message");
  const registerBtn = document.getElementById("register-btn");

  const fields = {
    name: document.getElementById("name"),
    email: document.getElementById("email"),
    age: document.getElementById("age"),
    password: document.getElementById("password"),
    confirm: document.getElementById("confirm-password"),
  };

  // Already logged in? No need to register again.
  const existing = await getCurrentUserProfile();
  if (existing) {
    window.location.replace(getHomePageForRole(existing.role));
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage(box);
    Object.values(fields).forEach((f) => setInvalid(f, false));

    const name = fields.name.value.trim();
    const email = fields.email.value.trim();
    const age = Number(fields.age.value);
    const password = fields.password.value;
    const confirm = fields.confirm.value;
    const role = form.querySelector('input[name="role"]:checked')?.value;

    // Validate field by field and stop at the first problem, so the
    // user only has ONE thing to fix at a time (simpler for seniors).
    let problem = null;
    if (!name) problem = { field: fields.name, message: t("fieldRequired") };
    else if (!email) problem = { field: fields.email, message: t("fieldRequired") };
    else if (!looksLikeEmail(email)) problem = { field: fields.email, message: t("errInvalidEmail") };
    else if (!Number.isInteger(age) || age < 1 || age > 120) {
      problem = { field: fields.age, message: t("ageRange") };
    } else if (!["elderly", "caregiver"].includes(role)) {
      // Admin cannot be chosen here (see SECURITY NOTE at top).
      problem = { field: form.querySelector('input[name="role"]'), message: t("fieldRequired") };
    } else if (password.length < 6) {
      problem = { field: fields.password, message: t("errWeakPassword") };
    } else if (password !== confirm) {
      problem = { field: fields.confirm, message: t("passwordsNotMatch") };
    }

    if (problem) {
      setInvalid(problem.field, true);
      showMessage(box, problem.message);
      problem.field.focus();
      return;
    }

    const restore = setBusy(registerBtn);
    try {
      const profile = await registerUser({
        name,
        email,
        age,
        password,
        role,
        languagePreference: getLanguage(), // keep the language they are using now
      });
      applyUserPreferences(profile);
      showMessage(box, t("registerSuccess"), "success");
      // Short pause so the success message can be read (and heard by screen readers)
      setTimeout(() => window.location.replace(getHomePageForRole(profile.role)), 1500);
    } catch (err) {
      console.error("Registration failed:", err);
      if (err?.code === "auth/email-already-in-use") setInvalid(fields.email, true);
      showMessage(box, t(friendlyAuthError(err).key));
      restore();
    }
  });
}

// ------------------------------------------------------------
// 5. FOR EVERY OTHER PAGE
// ------------------------------------------------------------

/**
 * Page guard. Call at the top of dashboard.js, settings, games...
 *
 * @param {string[]|null} allowedRoles  e.g. ["elderly"]; null = any logged-in user
 * @returns {Promise<object|null>} the profile, or null if the user is
 *          being redirected (stop your page code when you get null).
 */
export async function requireAuth(allowedRoles = null) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    setFlash("pleaseLoginFirst");
    window.location.replace("login.html");
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    setFlash("accessDenied");
    window.location.replace(getHomePageForRole(profile.role));
    return null;
  }

  applyUserPreferences(profile);
  return profile;
}

/** Log out and return to the login page. */
export async function logout() {
  try {
    await logoutUser();
  } catch (err) {
    console.error("Logout failed:", err);
  }
  window.location.replace("login.html");
}

/** Make every <button data-action="logout"> work. */
export function setupLogoutButtons() {
  document.querySelectorAll('[data-action="logout"]').forEach((btn) => {
    btn.addEventListener("click", logout);
  });
}

// ------------------------------------------------------------
// 6. AUTO-START (only does something on login / register pages)
// ------------------------------------------------------------
function autoInit() {
  applyTranslations();
  setupShowPassword();
  setupLanguageButtons();

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  if (loginForm) initLoginPage(loginForm);
  if (registerForm) initRegisterPage(registerForm);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoInit);
} else {
  autoInit();
}