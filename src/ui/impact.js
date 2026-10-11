/**
 * impact.js — section 06.
 *
 * One illustration and six situations. The illustration is a network that has
 * partly died: two nodes can still hear the tower, the rest reach it by hopping.
 * It is drawn from fixed coordinates and labelled as illustrative, because
 * claiming coverage would be exactly the kind of thing this project refuses.
 */

import { $, escapeHtml } from "./dom.js";
import { t } from "./i18n.js";

const NODES = [
  { id: "a", x: 66, y: 292, label: "village a", kind: "leaf" },
  { id: "b", x: 176, y: 208, label: "clinic", kind: "leaf" },
  { id: "c", x: 268, y: 286, label: "shelter", kind: "leaf" },
  { id: "d", x: 382, y: 196, label: "school", kind: "relay" },
  { id: "e", x: 448, y: 298, label: "yard", kind: "leaf" },
  { id: "f", x: 560, y: 130, label: "ridge relay", kind: "gateway" },
];

const HOPS = [
  ["a", "b"],
  ["b", "c"],
  ["c", "d"],
  ["d", "e"],
  ["d", "f"],
  ["e", "f"],
];

const TOWER = { x: 560, y: 66 };

const CARDS = [
  { icon: "i-bolt", key: "quake" },
  { icon: "i-offline", key: "blackout" },
  { icon: "i-radio", key: "remote" },
  { icon: "i-globe", key: "ferry" },
  { icon: "i-store", key: "old" },
  { icon: "i-send", key: "wildfire" },
];

export function initImpact() {
  const svg = $("#impact-map");
  const cards = $("#impact-cards");

  if (svg) {
    const byId = Object.fromEntries(NODES.map((node) => [node.id, node]));
    const hop = HOPS.map(([from, to]) => {
      const a = byId[from];
      const b = byId[to];
      return `<path class="impact__hop" d="M${a.x} ${a.y} L${b.x} ${b.y}"/>`;
    }).join("");

    const route = ["a", "b", "c", "d", "f"]
      .map((id, i) => `${i === 0 ? "M" : "L"}${byId[id].x} ${byId[id].y}`)
      .join(" ")
      .concat(` L${TOWER.x} ${TOWER.y}`);

    const dead = `<path class="impact__hop" d="M${byId.e.x} ${byId.e.y} L${TOWER.x} ${TOWER.y}" stroke="rgba(255,95,95,0.28)" stroke-dasharray="3 4"/>`;

    const arcs = [22, 34, 46]
      .map(
        (r, i) =>
          `<path class="impact__tower" d="M${TOWER.x - r} ${TOWER.y + 10} a${r} ${r} 0 0 1 ${
            r * 2
          } 0" opacity="${(0.5 - i * 0.13).toFixed(2)}" stroke-dasharray="2 5"/>`,
      )
      .join("");

    const nodes = NODES.map(
      (node) =>
        `<g class="impact__node${node.kind === "gateway" ? " is-gateway" : ""}" transform="translate(${node.x} ${node.y})">` +
        `<circle r="${node.kind === "gateway" ? 6.5 : node.kind === "relay" ? 5.5 : 4.5}"/>` +
        `<text x="0" y="${node.kind === "gateway" ? -13 : 15}" text-anchor="middle">${escapeHtml(
          node.label,
        )}</text></g>`,
    ).join("");

    svg.innerHTML =
      `<defs><pattern id="dotgrid" width="24" height="24" patternUnits="userSpaceOnUse">` +
      `<circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.085)"/></pattern></defs>` +
      `<rect width="640" height="380" fill="url(#dotgrid)"/>` +
      hop +
      dead +
      arcs +
      `<g transform="translate(${TOWER.x} ${TOWER.y})">` +
      `<path class="impact__tower" d="M0 12 L-7 -12 L7 -12 Z" stroke="rgba(255,255,255,0.24)"/>` +
      `<path class="impact__tower" d="M-9 -4 L9 -4 M-14 10 L14 10"/>` +
      `</g>` +
      `<text x="${TOWER.x}" y="${TOWER.y - 20}" text-anchor="middle" fill="rgba(255,95,95,0.8)" style="font-family:var(--font-mono);font-size:9px">tower · degraded</text>` +
      nodes +
      `<path class="impact__pulse" d="${route}"/>`;
  }

  renderCards(cards);
  document.addEventListener("wick:lang", () => renderCards(cards));
}

function renderCards(host) {
  if (!host) return;
  host.innerHTML = CARDS.map(
    (card) =>
      `<li class="card"><span class="card__icon" aria-hidden="true"><svg><use href="#${card.icon}"/></svg></span>` +
      `<span><b>${escapeHtml(t(`im.${card.key}.title`))}</b>` +
      `<p>${escapeHtml(t(`im.${card.key}.body`))}</p>` +
      `<span class="card__when">${escapeHtml(t(`im.${card.key}.when`))}</span></span></li>`,
  ).join("");
}
