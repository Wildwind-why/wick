/**
 * settings.js — the two switches that change everything else: 1% mode and
 * language. Both are persisted, both are announced on `document`, so no module
 * has to know about any other module.
 */

import { prefs } from "./dom.js";
import { applyI18n, getLang, setLang as setI18nLang, LANGS } from "./i18n.js";

const FONT_HREF = "assets/css/fonts.css";

export function getMode() {
  return document.documentElement.dataset.mode === "eco" ? "eco" : "full";
}

export function setMode(next, { persist = true } = {}) {
  const mode = next === "eco" ? "eco" : "full";
  document.documentElement.dataset.mode = mode;
  if (persist) prefs.set("mode", mode);
  if (mode === "full") ensureFonts();
  syncModeButtons();
  document.dispatchEvent(new CustomEvent("wick:mode", { detail: mode }));
  return mode;
}

export function toggleMode() {
  return setMode(getMode() === "eco" ? "full" : "eco");
}

/** Full mode wants the display typefaces; 1% mode never asks for them. */
function ensureFonts() {
  if (document.querySelector('link[href$="fonts.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  document.head.appendChild(link);
}

export async function setLanguage(lang) {
  const next = await setI18nLang(lang);
  prefs.set("lang", next);
  applyI18n(document);
  syncLangButton();
  document.dispatchEvent(new CustomEvent("wick:lang", { detail: next }));
  return next;
}

export async function cycleLanguage() {
  const ids = LANGS.map((l) => l.id);
  const index = ids.indexOf(getLang());
  return setLanguage(ids[(index + 1) % ids.length]);
}

function syncModeButtons() {
  const on = getMode() === "eco";
  for (const button of document.querySelectorAll("#eco-toggle, [data-eco-invite]")) {
    button.setAttribute("aria-pressed", String(on));
  }
  const footMode = document.getElementById("foot-mode");
  if (footMode) {
    footMode.textContent =
      getLang() === "zh" ? (on ? "1% 模式" : "完整模式") : on ? "1% mode" : "full mode";
  }
}

function syncLangButton() {
  const button = document.getElementById("lang-toggle");
  if (!button) return;
  const next = LANGS[(LANGS.findIndex((l) => l.id === getLang()) + 1) % LANGS.length];
  button.dataset.next = next.id;
  const label = button.querySelector(".visually-hidden");
  if (label) label.textContent = `${getLang().toUpperCase()} → ${next.label}`;
  const footLang = document.getElementById("foot-lang");
  if (footLang) footLang.textContent = getLang().toUpperCase();
}

export function initSettings() {
  // The pre-paint script already resolved mode and language, including any
  // deep-link override; here we only adopt what it decided.
  const root = document.documentElement;
  const mode = root.dataset.mode === "eco" ? "eco" : "full";
  setMode(mode, { persist: false });
  prefs.set("mode", mode);
  prefs.set("lang", getLang());
  applyI18n(document);
  syncLangButton();

  document.getElementById("eco-toggle")?.addEventListener("click", () => toggleMode());
  document.querySelector("[data-eco-invite]")?.addEventListener("click", () => {
    setMode("eco");
    document.getElementById("budget")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("lang-toggle")?.addEventListener("click", () => cycleLanguage());

  // Keep the foot label honest when either setting changes.
  document.addEventListener("wick:mode", syncModeButtons);
  syncModeButtons();
}
