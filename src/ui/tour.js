/**
 * tour.js — the guided demo.
 *
 * `DEMO.md` is a three-minute script. A script is fine for the person who
 * wrote it and useless to a judge who has ninety seconds and no idea which of
 * seven sections answers their question. This module turns that script into
 * seven steps the page can walk itself through: each step scrolls to the
 * section it is talking about, marks it, and says what to do there.
 *
 * It is off by default and costs nothing when it is off — one hidden element
 * and one listener. `?demo=1` opens it, the ▶ button in the top bar opens it,
 * Escape closes it, and left/right arrows move between steps.
 */

import { $, prefersReducedMotion } from "./dom.js";
import { t } from "./i18n.js";

/** Each step is one section, and one instruction. Keys live in lang/*.js. */
const STEPS = [
  { id: "top", key: "tour.s1" },
  { id: "cost", key: "tour.s2" },
  { id: "codec", key: "tour.s3" },
  { id: "budget", key: "tour.s4" },
  { id: "offline", key: "tour.s5" },
  { id: "field", key: "tour.s6" },
  { id: "craft", key: "tour.s7" },
];

export function initTour() {
  const bar = $("#tour");
  const toggle = $("#demo-toggle");
  if (!bar) return;

  const refs = {
    count: $("#tour-count"),
    body: $("#tour-body"),
    prev: $("#tour-prev"),
    next: $("#tour-next"),
    exit: $("#tour-exit"),
  };

  let index = -1;
  let open = false;

  const scrollTo = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  };

  const render = () => {
    const step = STEPS[index];
    if (!step) return;
    refs.count.textContent = `${index + 1} / ${STEPS.length}`;
    refs.body.textContent = t(step.key);
    // Mark the section being talked about, so "where am I" is answered by the
    // page rather than by the reader's memory of a scroll position.
    for (const section of document.querySelectorAll("main section")) {
      section.classList.toggle("is-tour", section.id === step.id);
    }
    if (refs.prev) refs.prev.disabled = index === 0;
    if (refs.next) refs.next.disabled = index === STEPS.length - 1;
    if (refs.prev) refs.prev.textContent = t("tour.prev");
    if (refs.next) refs.next.textContent = index === STEPS.length - 1 ? t("tour.done") : t("tour.next");
    if (refs.exit) refs.exit.textContent = t("tour.exit");
    scrollTo(step.id);
  };

  const go = (next) => {
    index = Math.min(STEPS.length - 1, Math.max(0, next));
    render();
  };

  const setOpen = (value) => {
    open = value;
    bar.hidden = !open;
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(open));
      toggle.classList.toggle("is-on", open);
    }
    if (open) {
      go(index < 0 ? 0 : index);
      refs.next?.focus({ preventScroll: true });
    } else {
      for (const section of document.querySelectorAll("main section")) {
        section.classList.remove("is-tour");
      }
    }
  };

  if (toggle) toggle.addEventListener("click", () => setOpen(!open));
  refs.prev?.addEventListener("click", () => go(index - 1));
  refs.next?.addEventListener("click", () => (index === STEPS.length - 1 ? setOpen(false) : go(index + 1)));
  refs.exit?.addEventListener("click", () => setOpen(false));

  document.addEventListener("keydown", (event) => {
    if (!open) return;
    if (event.key === "Escape") setOpen(false);
    else if (event.key === "ArrowRight") go(index + 1);
    else if (event.key === "ArrowLeft") go(index - 1);
  });

  // Language switches re-render the instruction in the other locale.
  document.addEventListener("wick:lang", () => {
    if (open) render();
  });

  // A deep link, because a judge should not have to find the button.
  if (new URLSearchParams(location.search).get("demo") === "1") setOpen(true);
}
