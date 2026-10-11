/**
 * i18n.js — one page, two languages, one downloaded.
 *
 * The work is exhibited in China and judged against an international bar, so
 * both audiences get real copy rather than machine translation. But a project
 * about not spending bytes has no business shipping a language nobody is
 * reading: only the selected table is fetched, and the other arrives the moment
 * somebody switches. `tests/page.test.html` asserts both tables carry exactly
 * the same keys, so a missing string fails a test instead of falling back
 * silently in front of a jury.
 */

export const LANGS = [
  { id: "en", label: "EN" },
  { id: "zh", label: "中文" },
];

const LANG_IDS = LANGS.map((l) => l.id);

let current = LANG_IDS.includes(document.documentElement.dataset.lang)
  ? document.documentElement.dataset.lang
  : "en";

const cache = new Map();

async function load(lang) {
  if (cache.has(lang)) return cache.get(lang);
  const module = await import(`./lang/${lang}.js`);
  cache.set(lang, module.default);
  return module.default;
}

// Top-level await: the module graph does not finish until the copy is here, so
// nothing renders a key by accident.
let table = await load(current);

export function getLang() {
  return current;
}

/** Switch language, fetching the other table only if we do not have it yet. */
export async function setLang(lang) {
  current = LANG_IDS.includes(lang) ? lang : "en";
  table = await load(current);
  document.documentElement.lang = current === "zh" ? "zh-CN" : "en";
  document.documentElement.dataset.lang = current;
  return current;
}

export function t(key, vars) {
  let value = table[key] ?? key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
  }
  return value;
}

/**
 * Paint every tagged node under `root`:
 *   data-i18n="key"                         → textContent
 *   data-i18n-html="key"                    → innerHTML
 *   data-i18n-attr="aria-label:key,title:k" → attributes
 *   data-i18n-placeholder="key"             → placeholder
 */
export function applyI18n(root = document) {
  for (const node of root.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll("[data-i18n-html]")) {
    node.innerHTML = t(node.dataset.i18nHtml);
  }
  for (const node of root.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of node.dataset.i18nAttr.split(",")) {
      const [attr, key] = pair.split(":").map((s) => s && s.trim());
      if (attr && key) node.setAttribute(attr, t(key));
    }
  }
  for (const node of root.querySelectorAll("[data-i18n-placeholder]")) {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  }
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", t("meta.desc"));
  document.title = t("meta.title");
}

/** Locale-aware number formatting, used by every readout on the page. */
export function nf(value, options = {}) {
  return new Intl.NumberFormat(current === "zh" ? "zh-CN" : "en-GB", options).format(value);
}
