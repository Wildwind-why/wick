/**
 * dom.js — a few honest helpers. No framework, because a 1% world has no room
 * for one, and because the DOM already works.
 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Tiny hyperscript. `h('div.panel', {id:'x'}, child, child)`
 */
export function h(spec, props = null, ...children) {
  const [tagAndId, ...classes] = String(spec).split(".");
  const [tag, id] = tagAndId.split("#");
  const node = document.createElement(tag || "div");
  if (id) node.id = id;
  if (classes.length) node.className = classes.join(" ");

  if (props && (typeof props !== "object" || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === "class") node.className = [node.className, value].filter(Boolean).join(" ");
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
      else if (key === "html") node.innerHTML = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === "dataset") Object.assign(node.dataset, value);
      else node.setAttribute(key, value === true ? "" : value);
    }
  }

  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Delegated listener: on(root, 'click', '.btn', handler) */
export function on(root, type, selector, handler, options) {
  root.addEventListener(
    type,
    (event) => {
      const target = event.target.closest(selector);
      if (target && root.contains(target)) handler(event, target);
    },
    options,
  );
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Trailing-edge throttle for scroll and input handlers. */
export function rafThrottle(fn) {
  let queued = false;
  let lastArgs = null;
  return (...args) => {
    lastArgs = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...lastArgs);
    });
  };
}

export function debounce(fn, ms = 160) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Animate a number from `from` to `to`, cheaply, without a tween library. */
export function tween(from, to, ms, onFrame, onDone) {
  if (ms <= 0) {
    onFrame(to);
    onDone?.();
    return () => {};
  }
  const start = performance.now();
  let raf = 0;
  const step = (now) => {
    const t = clamp((now - start) / ms, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    onFrame(from + (to - from) * eased);
    if (t < 1) raf = requestAnimationFrame(step);
    else onDone?.();
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

export function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

/**
 * Can this document host a Service Worker? Returns `null` when yes, or a short
 * reason when no.
 *
 * Three ways to be unable to, and they are all legitimate ways to open this
 * project: `file://` (double-clicking index.html), a browser without the API,
 * and a document written with `document.write` into an iframe — which is how
 * the integration test frames the page, and which reports `http:` as its
 * protocol while having no URL a worker could be registered against.
 * Registration in that last case throws "the document is in an invalid state",
 * so the check has to be on the full URL, not the protocol.
 */
export function workerUnsupportedReason() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  if (typeof window === "undefined" || !window.isSecureContext) return "insecure-context";
  let url;
  try {
    url = new URL(location.href);
  } catch {
    return "unparsable-url";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return `unsupported-url:${url.protocol}`;
  return null;
}

/** Persisted preference, tolerant of Safari private mode. */
export const prefs = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(`wick:${key}`);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`wick:${key}`, JSON.stringify(value));
    } catch {
      /* preferences are a nicety, never a requirement */
    }
  },
};
