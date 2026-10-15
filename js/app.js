/**
 * ============================================================
 * CogniCare - app.js
 * ------------------------------------------------------------
 * Main navigation and app logic shared by every page AFTER login.
 * FR025 (simple, consistent navigation), FR011 / FR012 (open games)
 *
 * WHAT IT DOES
 *  1. Protects the page (must be logged in, correct role).
 *  2. Applies the user's font size / contrast / language.
 *  3. Draws the SAME header + navigation on every page, so the
 *     layout is always familiar (good for seniors).
 *  4. On the home page: shows the welcome text and the game menu,
 *     and opens a game when a card is pressed.
 *
 * HOW A PAGE USES IT
 *  Put these attributes on <body> and load the script:
 *
 *    <body data-page="home" data-roles="elderly">
 *    ...
 *    <script type="module" src="js/app.js"></script>
 *
 *   data-page   "home" | "dashboard" | "settings"   (marks the
 *               current menu item; "home" also shows the game menu)
 *   data-roles  who may open the page, comma separated:
 *               "elderly" | "elderly,caregiver,admin" ...
 *               Leave it out to allow any logged-in user.
 *
 *  Other scripts can wait for the user like this:
 *    import { appReady } from "./app.js";
 *    const me = await appReady;      // profile, or null if redirected
 *
 * HTML IDs THIS FILE EXPECTS
 *  all pages    <header id="site-header" class="site-header"></header>
 *               (app.js fills it with the brand + navigation)
 *  index.html   h1#welcome-title, p#welcome-text,
 *               section#menu-view  > div#game-cards,
 *               section#game-view[hidden] > button#back-to-menu
 *                                         > div#game-container
 *
 * GAME FILES MUST FOLLOW THIS CONTRACT (game-nback.js, game-match3.js)
 *    export function startGame({ container, profile, onExit }) {
 *      // build the game inside `container`
 *      // call onExit() when the player wants to go back
 *      return function cleanup() { ...stop timers, listeners... };
 *    }
 * ============================================================
 */

import { requireAuth, setupLogoutButtons, applyUserPreferences } from "./auth.js";
import { t, applyTranslations } from "./translations.js";

// ------------------------------------------------------------
// 1. SETTINGS FOR THE MENUS
// ------------------------------------------------------------

/** Navigation links per role. `key` = translation key of the label. */
const NAV_ITEMS = {
  elderly: [
    { page: "home", href: "index.html", key: "home" },
    { page: "dashboard", href: "dashboard.html", key: "dashboard" },
    { page: "settings", href: "settings.html", key: "settings" },
  ],
  caregiver: [
    { page: "dashboard", href: "dashboard.html", key: "dashboard" },
    { page: "settings", href: "settings.html", key: "settings" },
  ],
  admin: [
    { page: "dashboard", href: "dashboard.html", key: "dashboard" },
    { page: "settings", href: "settings.html", key: "settings" },
  ],
};

/**
 * Line icons for the game cards (inline SVG, drawn with the theme colour
 * through "currentColor", so they also follow the high-contrast mode).
 * These are fixed strings written here, never user text.
 */
const ICON_STYLE = 'style="display:block;margin:0 auto;color:var(--primary)"';
const ICONS = {
  // Clock with a "go back" arrow = remember what came before (N-Back)
  nback: `<svg ${ICON_STYLE} width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M12 7v5l4 2"/>
    </svg>`,
  // Tile grid with one row highlighted = line up matching tiles (Match-3)
  match3: `<svg ${ICON_STYLE} width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M3 9h18v6H3z" fill="currentColor" fill-opacity="0.18"/>
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
    </svg>`,
};

/** The two games shown on the home page. */
const GAMES = [
  { id: "nback", nameKey: "nback", descKey: "nbackDesc", file: "./game-nback.js" },
  { id: "match3", nameKey: "match3", descKey: "match3Desc", file: "./game-match3.js" },
];

// Things we need to remember between function calls
let currentProfile = null;
let stopCurrentGame = null; // cleanup function returned by the running game

// ------------------------------------------------------------
// 2. SMALL DOM HELPER
// ------------------------------------------------------------

/**
 * Create an element in one line.
 *   el("a", { className: "btn", href: "x.html" }, "Text")
 * Uses textContent, so user text can never inject HTML.
 */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    // aria-* and role are set as attributes (works in every browser)
    if (name === "role") node.setAttribute("role", value);
    else if (name.startsWith("aria")) {
      node.setAttribute(name.replace(/^aria/, "aria-").toLowerCase(), value);
    } else node[name] = value;
  }
  children.forEach((child) => {
    if (child === null || child === undefined) return;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return node;
}

/** The icon above a game card. */
function iconBox(gameId) {
  const box = el("div", { className: "icon" });
  box.setAttribute("aria-hidden", "true");
  box.innerHTML = ICONS[gameId] || ""; // trusted constant, see ICONS above
  return box;
}

// ------------------------------------------------------------
// 3. HEADER + NAVIGATION  (same on every page)
// ------------------------------------------------------------

function renderHeader(profile) {
  const header = document.getElementById("site-header");
  if (!header) return;

  const currentPage = document.body.dataset.page || "";
  const items = NAV_ITEMS[profile.role] || NAV_ITEMS.elderly;

  // Brand links to the user's own start page
  const brand = el("a", {
    className: "brand",
    href: items[0].href,
    ariaLabel: "CogniCare",
  }, "CogniCare");

  // Menu links. The current page is marked with aria-current (CSS
  // shows it with colour AND underline, not colour alone).
  const list = el("ul");
  items.forEach((item) => {
    const link = el("a", { href: item.href }, t(item.key));
    if (item.page === currentPage) link.setAttribute("aria-current", "page");
    list.append(el("li", {}, link));
  });

  // Logout button (wired up by setupLogoutButtons)
  const logoutBtn = el("button", { type: "button", className: "btn btn-secondary" }, t("logout"));
  logoutBtn.dataset.action = "logout";
  list.append(el("li", {}, logoutBtn));

  const nav = el("nav", { className: "main-nav" }, list);
  nav.setAttribute("aria-label", "Main");

  header.replaceChildren(el("div", { className: "header-inner" }, brand, nav));
  setupLogoutButtons();
}

// ------------------------------------------------------------
// 4. HOME PAGE: WELCOME + GAME MENU
// ------------------------------------------------------------

function renderHome(profile) {
  const title = document.getElementById("welcome-title");
  const text = document.getElementById("welcome-text");
  if (title) title.textContent = t("welcomeUser", { name: profile.name });
  if (text) text.textContent = t("welcomeText");

  const cards = document.getElementById("game-cards");
  if (!cards) return;

  cards.replaceChildren(
    ...GAMES.map((game) => {
      const heading = el("h2", { id: `game-title-${game.id}` }, t(game.nameKey));
      const button = el("button", {
        type: "button",
        className: "btn btn-large btn-block",
      }, t("startGame"));
      button.setAttribute("aria-describedby", `game-title-${game.id}`);
      button.addEventListener("click", () => launchGame(game));

      return el(
        "article",
        { className: "card game-card" },
        iconBox(game.id),
        heading,
        el("p", {}, t(game.descKey)),
        button
      );
    })
  );
}

/** Show the menu and hide the game. */
function showMenu() {
  if (typeof stopCurrentGame === "function") {
    try {
      stopCurrentGame();
    } catch (err) {
      console.error("Error while stopping the game:", err);
    }
  }
  stopCurrentGame = null;

  // Stop any voice that is still speaking
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();

  const menu = document.getElementById("menu-view");
  const gameView = document.getElementById("game-view");
  const container = document.getElementById("game-container");
  if (container) container.replaceChildren();
  if (gameView) gameView.hidden = true;
  if (menu) menu.hidden = false;

  // Put keyboard focus back on the page title so screen-reader and
  // keyboard users know where they are.
  const title = document.getElementById("welcome-title");
  if (title) {
    title.tabIndex = -1;
    title.focus();
  }
  window.scrollTo(0, 0);
}

/** Load a game file on demand and start it. */
async function launchGame(game) {
  const menu = document.getElementById("menu-view");
  const gameView = document.getElementById("game-view");
  const container = document.getElementById("game-container");
  if (!menu || !gameView || !container) return;

  menu.hidden = true;
  gameView.hidden = false;
  window.scrollTo(0, 0);

  container.replaceChildren(el("p", { className: "loading", role: "status" }, t("loading")));

  try {
    // Dynamic import: the game code is only downloaded when needed.
    const module = await import(game.file);
    if (typeof module.startGame !== "function") {
      throw new Error(`${game.file} does not export startGame()`);
    }
    container.replaceChildren();
    stopCurrentGame = module.startGame({
      container,
      profile: currentProfile,
      onExit: showMenu,
    });
  } catch (err) {
    console.error(`Could not start ${game.id}:`, err);
    container.replaceChildren(
      el("div", { className: "alert alert-error", role: "alert" }, t("errGeneric"))
    );
  }
}

function initHome(profile) {
  renderHome(profile);

  const back = document.getElementById("back-to-menu");
  if (back) back.addEventListener("click", showMenu);
}

// ------------------------------------------------------------
// 5. START-UP
// ------------------------------------------------------------

/**
 * Check login, apply preferences, draw the header, start the page.
 * @returns {Promise<object|null>} the user's profile (null = redirected)
 */
async function initApp() {
  const page = document.body.dataset.page;
  if (!page) return null; // not an app page (e.g. a test page)

  const roles = document.body.dataset.roles
    ? document.body.dataset.roles.split(",").map((r) => r.trim()).filter(Boolean)
    : null;

  const profile = await requireAuth(roles);
  if (!profile) return null; // requireAuth is already redirecting

  currentProfile = profile;
  applyUserPreferences(profile);
  renderHeader(profile);
  applyTranslations();
  if (page === "home") initHome(profile);

  // When the language is changed, redraw everything that was built by JS.
  window.addEventListener("languagechange", () => {
    renderHeader(profile);
    if (page === "home") renderHome(profile);
    applyTranslations();
  });

  // Remove the "loading" cover (if the page has one) now that we are ready.
  document.body.classList.remove("app-loading");
  return profile;
}

/** Other scripts can `await appReady` to get the logged-in profile. */
export const appReady = initApp().catch((err) => {
  console.error("App could not start:", err);
  return null;
});

/** Read-only access to the current profile (null before login finishes). */
export function getProfile() {
  return currentProfile;
}