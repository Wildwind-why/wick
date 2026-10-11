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
  const rows = [];
  const naiveLabels = Object.fromEntries(NAIVE_GROUPS.map((g) => [g.key, g]));

  for (const part of naiveParts) {
    if (part.bytes <= 0) continue;
    const meta = naiveLabels[part.key];
    rows.push({
      key: part.key,
      bar: "naive",
      label: t(meta.label),
      colour: part.colour,
      bytes: part.bytes,
    });
  }
  for (const part of wickParts) {
    const meta = WICK_GROUPS[part.key] || WICK_GROUPS.header;
    rows.push({
      key: part.key,
      bar: "wick",
      label: t(meta.label),
      colour: part.colour,
      bytes: part.bytes,
    });
  }

  host.innerHTML = rows
    .map(
      (row) =>
        `<li data-key="${escapeHtml(row.key)}" data-bar="${row.bar}">` +
        `<span class="legend__swatch" style="background:${row.colour}"></span>` +
        `${escapeHtml(row.label)}` +
        `<span class="legend__val">${row.bytes.toFixed(1)} B</span></li>`,
    )
    .join("");

  // Hovering a legend entry isolates that field in both bars.
  host.querySelectorAll("li").forEach((li) => {
    const key = li.dataset.key;
    const enter = () => highlight(key);
    const leave = () => highlight(null);
    li.addEventListener("mouseenter", enter);
    li.addEventListener("mouseleave", leave);
    li.addEventListener("focus", enter);
    li.addEventListener("blur", leave);
  });

  function highlight(key) {
    for (const bar of [document.getElementById("anatomy-naive"), document.getElementById("anatomy-wick")]) {
      if (!bar) continue;
      bar.classList.toggle("is-dimmed", Boolean(key));
      for (const seg of bar.children) {
        const on = key && seg.dataset.key === key;
        seg.toggleAttribute("data-hi", Boolean(on));
        seg.style.filter = on ? "brightness(1.16)" : "";
      }
    }
    for (const li of host.children) {
      li.classList.toggle("is-dim", Boolean(key) && li.dataset.key !== key);
    }
  }
}
