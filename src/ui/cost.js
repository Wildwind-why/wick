/**
 * cost.js — section 01.
 *
 * Two stacked bars on the same scale. The grey one is what a mainstream
 * messenger spends on one fact. The ember one is what wick spends. Then the
 * batch slider lets you watch the fixed costs collapse — because that is the
 * half of the problem that no amount of clever encoding can solve on its own.
 */

import { $, escapeHtml } from "./dom.js";
import { t, nf } from "./i18n.js";
import { measure } from "../core/codec.js";
import { naiveEnvelope, byteLength, FRAMING } from "../core/baseline.js";
import { onState, state, codecContext, setBytesSaved } from "./state.js";

/** The demonstration message: a check-in with a fix and a timestamp. */
const MESSAGE = () => state.message;

const NAIVE_GROUPS = [
  { key: "payload", label: "c1.legend.payload", colour: "#3D3D49" },
  { key: "tls", label: "c1.legend.tls", colour: "#4A5A7A" },
  { key: "tcp", label: "c1.legend.tcp", colour: "#5C6F92" },
  { key: "h2", label: "c1.legend.h2", colour: "#6E82A9" },
  { key: "keep", label: "c1.legend.keep", colour: "#7F94BC" },
];

const WICK_GROUPS = {
  header: { label: "c1.legend.header", colour: "#86B6FF" },
  token: { label: "c1.legend.token", colour: "#FF7A33" },
  position: { label: "c1.legend.pos", colour: "#6FE3A6" },
  time: { label: "c1.legend.time", colour: "#FFCF6B" },
  text: { label: "c1.legend.text", colour: "#C5A0FF" },
  integrity: { label: "c1.legend.crc", colour: "#FF5F5F" },
  transport: { label: "c1.legend.tls", colour: "#4A5A7A" },
};

export function initCost() {
  // The message-body colour is the one semantic colour outside the warm/cold
  // accents; bind it to the --payload token so it can never silently drift.
  const payload = getComputedStyle(document.documentElement).getPropertyValue("--payload").trim();
  if (payload) WICK_GROUPS.text.colour = payload;

  const batch = $("#cost-batch");
  const batchVal = $("#cost-batch-val");
  const naiveBar = $("#anatomy-naive");
  const wickBar = $("#anatomy-wick");
  const legend = $("#cost-legend");
  if (!batch || !naiveBar || !wickBar) return;

  const render = () => {
    const size = Math.max(1, Number(batch.value));
    if (batchVal) batchVal.textContent = nf(size);

    const measurement = measure(MESSAGE(), codecContext());
    const payload = byteLength(JSON.stringify(naiveEnvelope(MESSAGE())));

    // Every fixed cost is divided by the batch: one transmission, many messages.
    const naiveParts = [
      { key: "payload", bytes: payload, colour: NAIVE_GROUPS[0].colour },
      { key: "tls", bytes: FRAMING.tlsRecord / size, colour: NAIVE_GROUPS[1].colour },
      { key: "tcp", bytes: FRAMING.tcpIp / size, colour: NAIVE_GROUPS[2].colour },
      { key: "h2", bytes: FRAMING.http2 / size, colour: NAIVE_GROUPS[3].colour },
      { key: "keep", bytes: FRAMING.signalling / size, colour: NAIVE_GROUPS[4].colour },
    ];

    const wickParts = [];
    for (const field of measurement.fields) {
      const existing = wickParts.find((p) => p.key === field.group);
      const bytes = field.to - field.from;
      if (existing) existing.bytes += bytes;
      else
        wickParts.push({
          key: field.group,
          bytes,
          colour: (WICK_GROUPS[field.group] || WICK_GROUPS.header).colour,
        });
    }
    // wick still pays transport on an IP radio, once per transmission
    wickParts.push({
      key: "transport",
      bytes: FRAMING.transport / size,
      colour: WICK_GROUPS.transport.colour,
    });

    const naiveTotal = naiveParts.reduce((sum, p) => sum + p.bytes, 0);
    const wickTotal = wickParts.reduce((sum, p) => sum + p.bytes, 0);
    const scale = naiveTotal;

    paint(naiveBar, naiveParts, scale);
    // The wick bar is drawn at true scale. A small floor keeps it legible
    // without flattering it: the row's byte count is the honest figure.
    paint(wickBar, wickParts, scale, 0.9);

    if ($("#cost-naive-total")) $("#cost-naive-total").textContent = nf(naiveTotal, { maximumFractionDigits: 1 });
    if ($("#cost-wick-total")) $("#cost-wick-total").textContent = nf(wickTotal, { maximumFractionDigits: 1 });
    if ($("#cost-naive-per")) $("#cost-naive-per").textContent = nf(Math.round(naiveTotal));
    if ($("#cost-wick-per")) $("#cost-wick-per").textContent = nf(Math.round(wickTotal));
    if ($("#cost-naive-all")) $("#cost-naive-all").textContent = nf(Math.round(naiveTotal * size));
    if ($("#cost-wick-all")) $("#cost-wick-all").textContent = nf(Math.round(wickTotal * size));

    const ratio = wickTotal > 0 ? naiveTotal / wickTotal : 0;
    if ($("#cost-ratio")) $("#cost-ratio").textContent = `${ratio.toFixed(1)}×`;
    if ($("#cost-transmissions")) {
      $("#cost-transmissions").textContent =
        size === 1 ? t("c1.tx.one") : t("c1.tx.many", { n: nf(size) });
    }

    renderLegend(legend, naiveParts, wickParts, measurement);

    setBytesSaved(Math.round((naiveTotal - wickTotal) * size));

    // The raw-radio figure is the pure frame ratio, with no IP framing at all.
    const rawNote = $("#cost-raw-note");
    if (rawNote) {
      rawNote.textContent = t("c1.raw", {
        raw: (payload / measurement.size).toFixed(0),
      });
    }
  };

  batch.addEventListener("input", render);
  onState((_, source) => {
    if (source === "saved") return;
    render();
  });
  render();
}

function paint(host, parts, scale, minPct = 0) {
  host.innerHTML = "";
  const total = parts.reduce((sum, p) => sum + p.bytes, 0);
  const truePct = (total / scale) * 100;
  // Stretch every segment by the same factor so relative widths stay true.
  const stretch = minPct > 0 && truePct > 0 && truePct < minPct ? minPct / truePct : 1;

  for (const part of parts) {
    if (part.bytes <= 0) continue;
    const width = (part.bytes / scale) * 100 * stretch;
    const seg = document.createElement("span");
    seg.className = "anatomy__seg";
    seg.dataset.group = part.key;
    seg.dataset.key = part.key;
    seg.style.width = `${width}%`;
    seg.style.background = part.colour;
    seg.title = `${part.key} · ${part.bytes.toFixed(1)} B`;
    seg.innerHTML = width > 9 ? `<span>${Math.round(part.bytes)}</span>` : "";
    host.appendChild(seg);
  }
}

function renderLegend(host, naiveParts, wickParts, measurement) {
  if (!host) return;
  const naiveLabels = Object.fromEntries(NAIVE_GROUPS.map((g) => [g.key, g]));

  // Every part, in order, for the drill-down table.
  const allRows = [];
  for (const part of naiveParts) {
    if (part.bytes <= 0) continue;
    const meta = naiveLabels[part.key];
    allRows.push({ key: part.key, bar: "naive", label: t(meta.label), colour: part.colour, bytes: part.bytes });
  }
  for (const part of wickParts) {
    const meta = WICK_GROUPS[part.key] || WICK_GROUPS.header;
    allRows.push({ key: part.key, bar: "wick", label: t(meta.label), colour: part.colour, bytes: part.bytes });
  }

  // Only three segments are genuinely discernible on the bar — surface those in
  // the legend, and push the sub-byte breakdown into a collapsible table.
  const payload = naiveParts.find((p) => p.key === "payload");
  const text = wickParts.find((p) => p.key === "text");
  const frameKeys = ["header", "token", "position", "time", "integrity", "transport"];
  const frameBytes = wickParts
    .filter((p) => frameKeys.includes(p.key))
    .reduce((s, p) => s + p.bytes, 0);
  const primary = [
    {
      keys: ["payload"],
      label: t("c1.legend.payload"),
      colour: payload ? payload.colour : NAIVE_GROUPS[0].colour,
      bytes: payload ? payload.bytes : 0,
    },
    {
      keys: ["text"],
      label: t("c1.legend.text"),
      colour: text ? text.colour : WICK_GROUPS.text.colour,
      bytes: text ? text.bytes : 0,
    },
    {
      keys: frameKeys,
      label: t("c1.legend.frame"),
      colour: WICK_GROUPS.header.colour,
      bytes: frameBytes,
    },
  ];

  host.innerHTML =
    `<ul class="legend legend--primary">` +
    primary
      .map(
        (row) =>
          `<li data-keys="${row.keys.join(",")}">` +
          `<span class="legend__swatch" style="background:${row.colour}"></span>` +
          `${escapeHtml(row.label)}` +
          `<span class="legend__val">${row.bytes.toFixed(1)} B</span></li>`,
      )
      .join("") +
    `</ul>` +
    `<details class="legend-detail">` +
    `<summary>${escapeHtml(t("c1.legend.more"))}</summary>` +
    `<table class="legend-detail__table"><tbody>` +
    allRows
      .map(
        (row) =>
          `<tr data-keys="${row.key}">` +
          `<td><span class="legend__swatch" style="background:${row.colour}"></span></td>` +
          `<td class="legend-detail__label">${escapeHtml(row.label)}</td>` +
          `<td class="legend-detail__bar">${row.bar === "naive" ? "JSON" : "wick"}</td>` +
          `<td class="legend-detail__val">${row.bytes.toFixed(1)} B</td></tr>`,
      )
      .join("") +
    `</tbody></table>` +
    `</details>`;

  // Hovering any entry (primary or drill-down) isolates those fields in both bars.
  for (const row of host.querySelectorAll("[data-keys]")) {
    const keys = row.dataset.keys.split(",");
    const enter = () => highlight(keys);
    const leave = () => highlight(null);
    row.addEventListener("mouseenter", enter);
    row.addEventListener("mouseleave", leave);
    row.addEventListener("focus", enter);
    row.addEventListener("blur", leave);
  }

  function highlight(keys) {
    const keySet = keys ? new Set(keys) : null;
    for (const id of ["anatomy-naive", "anatomy-wick"]) {
      const bar = document.getElementById(id);
      if (!bar) continue;
      bar.classList.toggle("is-dimmed", Boolean(keySet));
      for (const seg of bar.children) {
        const on = keySet && keySet.has(seg.dataset.key);
        seg.toggleAttribute("data-hi", Boolean(on));
        seg.style.filter = on ? "brightness(1.16)" : "";
      }
    }
    for (const row of host.querySelectorAll("[data-keys]")) {
      const rk = row.dataset.keys.split(",");
      row.classList.toggle("is-dim", Boolean(keySet) && !rk.some((k) => keySet.has(k)));
    }
  }
}
