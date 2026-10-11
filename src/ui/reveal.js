/**
 * reveal.js — scroll behaviour.
 *
 * Reveals are staggered per section so the page arrives with a rhythm instead
 * of all at once, and the nav marks where you are. Everything here is switched
 * off by prefers-reduced-motion and by 1% mode, and the content is visible by
 * default if scripting never runs at all.
 */

import { $$, prefersReducedMotion } from "./dom.js";
import { getMode } from "./settings.js";

export function initReveal() {
  const targets = $$("[data-reveal]");
  const sections = $$("main section[id]");
  const links = $$(".topnav a");

  const markCurrent = () => {
    const line = window.innerHeight * 0.34;
    let active = null;
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= line && rect.bottom > line) active = section.id;
    }
    for (const link of links) {
      link.setAttribute("aria-current", String(link.hash === `#${active}`));
    }
  };

  const still = document.documentElement.dataset.still === "1";
  if (still || prefersReducedMotion() || !("IntersectionObserver" in window)) {
    for (const node of targets) node.classList.add("is-in");
    markCurrent();
    window.addEventListener("scroll", markCurrent, { passive: true });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const node = entry.target;
        const siblings = [...(node.parentElement?.querySelectorAll(":scope > [data-reveal]") || [])];
        const index = Math.max(0, siblings.indexOf(node));
        node.style.setProperty("--reveal-delay", `${Math.min(index * 90, 380)}ms`);
        node.classList.add("is-in");
        observer.unobserve(node);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
  );

  for (const node of targets) observer.observe(node);

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        markCurrent();
      });
    },
    { passive: true },
  );
  markCurrent();

  // Entering 1% mode shows everything immediately: no motion, no waiting.
  document.addEventListener("wick:mode", () => {
    if (getMode() !== "eco") return;
    for (const node of targets) node.classList.add("is-in");
  });
}
