/**
 * bench.js — section 02, the codec bench.
 *
 * Compose a message and watch the actual bytes it becomes: every byte is owned
 * by a field, every field has a name, and the frame that comes back out of the
 * decoder is checked against what went in. If the round trip fails, this panel
 * says so — the verification is real, not decorative.
 */

import { $, on, escapeHtml } from "./dom.js";
import { t, nf } from "./i18n.js";
import { measure, dictionaryCoverage, URGENCY, TYPES } from "../core/codec.js";
import { simulate, formatJoules, RADIOS } from "../core/energy.js";
import { naiveWire, batched, framingFor } from "../core/baseline.js";
import { onState, state, setState, codecContext } from "./state.js";

const GROUPS = {
  header: { label: "c1.legend.header", max: "92,182,255" },
  token: { label: "c1.legend.token", max: "255,122,51" },
  position: { label: "c1.legend.pos", max: "111,227,166" },
  time: { label: "c1.legend.time", max: "255,207,107" },
  text: { label: "c1.legend.text", max: "197,160,255" },
  integrity: { label: "c1.legend.crc", max: "255,95,95" },
};

const STATUS_OPTIONS = [
  "safe", "ok", "injured", "trapped", "stable", "unknown",
  "moving", "arrived", "stopped", "waiting", "clear", "damaged",
];

const NEED_OPTIONS = [
  "help", "water", "food", "medical", "shelter", "power",
  "signal", "radio", "phone", "battery", "transport",
];

const PRESETS = [
  { label: "I’m safe", message: { type: "checkin", status: "safe" } },
  { label: "safe + fix", message: { type: "checkin", status: "safe" } },
  { label: "water, urgent", message: { type: "need", need: "water", urgency: 2 } },
  { label: "medical, critical", message: { type: "need", need: "medical", urgency: 3 } },
  { label: "trapped, 12 children", message: { type: "sitrep", text: "trapped in school, 12 children, send help" } },
  { label: "bridge damaged", message: { type: "sitrep", text: "bridge damaged, route closed" } },
  { label: "ack", message: { type: "ack", sequence: 4211 } },
];

export function initBench() {
  // Keep the message-body colour bound to the --payload token (hex → "r,g,b").
  const payload = getComputedStyle(document.documentElement).getPropertyValue("--payload").trim();
  if (payload && /^#[0-9a-f]{6}$/i.test(payload)) {
    const n = parseInt(payload.slice(1), 16);
    GROUPS.text.max = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }

  const refs = {
    presets: $("#bench-presets"),
    types: $("#bench-types"),
    status: $("#bench-status"),
    need: $("#bench-need"),
    urgency: $("#bench-urgency"),
    text: $("#bench-text"),
    pos: $("#bench-pos"),
    time: $("#bench-time"),
    burst: $("#bench-burst"),
    burstOut: $("#bench-burst-out"),
    hex: $("#bench-hex"),
    legend: $("#bench-legend"),
    decoded: $("#bench-decoded"),
    ok: $("#bench-ok"),
    size: $("#bench-size"),
    bits: $("#bench-bits"),
    metrics: $("#bench-metrics"),
    tag: $("#bench-type-tag"),
    statusField: $("#bench-status-field"),
    needField: $("#bench-need-field"),
    urgencyField: $("#bench-urgency-field"),
    textField: $("#bench-text-field"),
  };
  if (!refs.hex) return;

  /* ---- populate the controls ------------------------------------------ */
  refs.presets.innerHTML = PRESETS.map(
    (preset, i) => `<button class="chip" type="button" data-preset="${i}">${escapeHtml(preset.label)}</button>`,
  ).join("");

  refs.types.innerHTML = Object.keys(TYPES)
    .map((name) => `<button type="button" data-type="${name}">${name}</button>`)
    .join("");

  refs.status.innerHTML = STATUS_OPTIONS.map(
    (word) => `<option value="${word}">${word}</option>`,
  ).join("");
  refs.need.innerHTML = NEED_OPTIONS.map((word) => `<option value="${word}">${word}</option>`).join("");
  refs.urgency.innerHTML = URGENCY.map(
    (name, level) => `<button type="button" data-urgency="${level}">${name}</button>`,
  ).join("");

  /* ---- controls → state ----------------------------------------------- */
  on(refs.presets, "click", "[data-preset]", (_, el) => {
    const preset = PRESETS[Number(el.dataset.preset)];
    applyMessage(preset.message);
  });

  on(refs.types, "click", "[data-type]", (_, el) => {
    const type = el.dataset.type;
    const next = { ...state.message, type };
    if (type === "sitrep" && !next.text) next.text = "trapped in school, 12 children, send help";
    if (type === "ack") next.sequence = next.sequence ?? 4211;
    applyMessage(next);
    refs.text?.focus();
  });

  on(refs.urgency, "click", "[data-urgency]", (_, el) => {
    applyMessage({ ...state.message, urgency: Number(el.dataset.urgency) });
  });

  refs.status.addEventListener("change", () =>
    applyMessage({ ...state.message, status: refs.status.value }),
  );
  refs.need.addEventListener("change", () => applyMessage({ ...state.message, need: refs.need.value }));
  refs.text.addEventListener("input", () => applyMessage({ ...state.message, text: refs.text.value }));

  const togglePosition = () => {
    const on_ = refs.pos.checked;
    applyMessage({
      ...state.message,
      position: on_ ? { ...codecContext().origin } : undefined,
    });
  };
  const toggleTime = () => {
    const on_ = refs.time.checked;
    applyMessage({
      ...state.message,
      time: on_ ? codecContext().prevTime + 42 : undefined,
    });
  };
  refs.pos.addEventListener("change", togglePosition);
  refs.time.addEventListener("change", toggleTime);

  /* ---- bulk encode, off the main thread -------------------------------- */
  refs.burst?.addEventListener("click", () => runBurst(refs.burstOut, refs.burst));

  /* ---- state → render -------------------------------------------------- */
  onState((_, source) => {
    if (source === "bench") return;
    paint(refs, measure(state.message, codecContext()));
  });

  syncControls(refs);
  paint(refs, measure(state.message, codecContext()));
}

function applyMessage(next) {
  setState({ message: next }, "bench");
  const refs = benchRefs;
  if (refs) {
    syncControls(refs);
    paint(refs, measure(next, codecContext()));
  }
}

let benchRefs = null;

function syncControls(refs) {
  benchRefs = refs;
  const message = state.message;
  for (const button of refs.types.children) {
    button.setAttribute("aria-pressed", String(button.dataset.type === message.type));
  }
  for (const button of refs.urgency.children) {
    button.setAttribute(
      "aria-pressed",
      String(Number(button.dataset.urgency) === (message.urgency ?? 1)),
    );
  }
  refs.statusField.hidden = message.type !== "checkin";
  refs.needField.hidden = message.type !== "need";
  refs.urgencyField.hidden = message.type !== "need";
  refs.textField.hidden = message.type !== "sitrep";
  if (message.type === "checkin") refs.status.value = message.status || "safe";
  if (message.type === "need") refs.need.value = message.need || "help";
  if (message.type === "sitrep" && refs.text.value !== (message.text || "")) {
    refs.text.value = message.text || "";
  }
  refs.pos.checked = Boolean(message.position);
  refs.time.checked = Number.isFinite(message.time);
  if (refs.tag) refs.tag.textContent = message.type;
}

function paint(refs, measurement) {
  const message = state.message;
  const radioId = state.radioId || "lte";
  const na = naiveWire(message, radioId);
  const framing = framingFor(radioId);

  /* frame ------------------------------------------------------------- */
  const owner = fieldOwners(measurement.fields, measurement.size);
  refs.hex.classList.remove("is-scanning");
  // NB: Uint8Array.prototype.map returns a typed array, not markup — hence Array.from.
  refs.hex.innerHTML = Array.from(measurement.bytes)
    .map((byte, i) => {
      const field = owner[i] || { group: "header", label: "" };
      const hex = byte.toString(16).toUpperCase().padStart(2, "0");
      return (
        `<span class="byte" data-group="${field.group}" data-key="${field.group}" style="--i:${i}" title="${escapeHtml(
          field.label,
        )}">` +
        `<b>${hex}</b><i>${escapeHtml(field.short || field.group)}</i></span>`
      );
    })
    .join("");
  void refs.hex.offsetWidth;
  refs.hex.classList.add("is-scanning");

  refs.size.textContent = nf(measurement.size);
  refs.bits.textContent = nf(measurement.size * 8);

  /* legend ------------------------------------------------------------ */
  const totals = new Map();
  for (const field of measurement.fields) {
    const bytes = Math.max(1, field.to - field.from);
    totals.set(field.group, (totals.get(field.group) || 0) + bytes);
  }
  refs.legend.innerHTML = [...totals.entries()]
    .map(([group, bytes]) => {
      const meta = GROUPS[group] || GROUPS.header;
      return (
        `<li data-key="${group}">` +
        `<span class="legend__swatch" style="background:rgba(${meta.max},0.85)"></span>` +
        `${escapeHtml(t(meta.label))}<span class="legend__val">${bytes} B</span></li>`
      );
    })
    .join("");
  wireLegend(refs);

  /* decoded ------------------------------------------------------------ */
  refs.decoded.textContent = describe(measurement.decoded || {});

  const badge = refs.ok;
  badge.dataset.state = measurement.ok ? "ok" : "fail";
  badge.querySelector("svg use").setAttribute("href", measurement.ok ? "#i-check" : "#i-x");
  badge.querySelector("span").textContent = t(measurement.ok ? "c2.ok" : "c2.fail");

  /* metrics ------------------------------------------------------------ */
  const perMessage = batched(measurement.size, state.batchSize || 1, framing.wick);
  const energy = simulate({
    resourceId: state.resourceId || "phone",
    levelPct: state.levelPct ?? 1,
    bytes: perMessage,
    radioId,
    batchSize: state.batchSize || 1,
  });
  const saved = 1 - measurement.size / Math.max(1, na.total);
  const coverage = message.type === "sitrep" ? dictionaryCoverage(message.text || "") : null;

  refs.metrics.innerHTML = [
    metric(t("c2.size"), `${nf(measurement.size)} B`),
    metric(
      t("c2.saved"),
      `${(saved * 100).toFixed(0)}%`,
      `${nf(na.total)} B`,
    ),
    metric(t("c2.energy"), formatJoules(energy.perMessageJ), RADIOS[radioId]?.short || radioId),
    coverage
      ? metric(
          t("c2.eff"),
          `${(coverage.ratio * 100).toFixed(0)}%`,
          `${nf(coverage.tokenChars)}/${nf(coverage.tokenChars + coverage.literalChars)} chars`,
        )
      : metric(
          t("c2.eff"),
          `${(measurement.efficiency * 100).toFixed(0)}%`,
          t("c2.eff.note"),
        ),
  ].join("");
}

function metric(key, value, note) {
  return (
    `<div class="readout"><span class="readout__k">${escapeHtml(key)}</span>` +
    `<span class="readout__v mono">${escapeHtml(value)}</span>` +
    (note ? `<span class="readout__sub mono">${escapeHtml(note)}</span>` : "") +
    `</div>`
  );
}

/** Which field owns each byte: prefer the most specific range. */
function fieldOwners(fields, size) {
  const owner = new Array(size).fill(null);
  for (const field of fields) {
    const from = Math.max(0, field.from);
    const to = Math.min(size, Math.max(field.to, field.from + 1));
    for (let i = from; i < to; i++) {
      const current = owner[i];
      if (!current || field.to - field.from < current.to - current.from) {
        owner[i] = {
          group: field.group,
          label: `${field.label} · ${field.group}`,
          short: shortLabel(field),
        };
      }
    }
  }
  return owner.map((o) => o || { group: "header", label: "header", short: "hdr" });
}

function shortLabel(field) {
  // First segment of the label is the field name; the rest is its value.
  const name = String(field.label).split("·")[0].trim();
  return ({ header: "header", crc8: "crc8" }[name] || name || field.group).slice(0, 8);
}

function wireLegend(refs) {
  refs.legend.querySelectorAll("li").forEach((li) => {
    const key = li.dataset.key;
    const set = (active) => {
      refs.hex.classList.toggle("is-dimmed", Boolean(active));
      for (const cell of refs.hex.children) {
        cell.classList.toggle("is-hi", Boolean(active) && cell.dataset.group === key);
      }
      for (const item of refs.legend.children) {
        item.classList.toggle("is-dim", Boolean(active) && item !== li);
      }
    };
    li.addEventListener("mouseenter", () => set(key));
    li.addEventListener("mouseleave", () => set(null));
  });
}

function describe(decoded) {
  switch (decoded.type) {
    case "checkin":
      return `checkin · status=${decoded.status}` + tail(decoded);
    case "need":
      return `need · ${decoded.need} · ${URGENCY[decoded.urgency] ?? "?"}` + tail(decoded);
    case "sitrep":
      return `sitrep · “${decoded.text}”` + tail(decoded);
    case "ack":
      return `ack · seq=${decoded.sequence}`;
    case "beacon":
      return `beacon` + tail(decoded);
    default:
      return "—";
  }
}

function tail(decoded) {
  const parts = [];
  if (decoded.position) {
    parts.push(`fix ${decoded.position.lat.toFixed(4)},${decoded.position.lon.toFixed(4)}`);
  }
  if (Number.isFinite(decoded.time)) {
    const delta = decoded.time - codecContext().prevTime;
    parts.push(`t+${delta}s`);
  }
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}

/* ------------------------------------------------------------------------ */
/* bulk encode                                                               */
/* ------------------------------------------------------------------------ */

let worker = null;

function getWorker() {
  if (worker) return worker;
  try {
    worker = new Worker(new URL("../workers/codec.worker.js", import.meta.url), { type: "module" });
  } catch {
    worker = null;
  }
  return worker;
}

function runBurst(outEl, button) {
  const count = 20000;
  const message = state.message;
  const context = codecContext();
  const local = getWorker();
  if (button) button.disabled = true;
  if (outEl) outEl.textContent = "…";

  const finish = (result) => {
    if (button) button.disabled = false;
    if (!outEl) return;
    const perFrame = (result.ms * 1000) / count;
    outEl.textContent =
      `${nf(count)} frames · ${result.ms.toFixed(0)} ms · ` +
      `${perFrame.toFixed(2)} µs/frame · ${nf(result.bytes)} B total`;
  };

  if (local) {
    const id = Math.random().toString(36).slice(2);
    const handler = (event) => {
      if (event.data.id !== id) return;
      local.removeEventListener("message", handler);
      finish(event.data);
    };
    local.addEventListener("message", handler);
    local.postMessage({ id, count, message, context });
    return;
  }

  // No Worker available (rare): do it here, and say so by being slower.
  const started = performance.now();
  let bytes = 0;
  for (let i = 0; i < count; i++) {
    bytes += measure({ ...message, time: context.prevTime + (i % 3600) }, context).size;
  }
  finish({ ms: performance.now() - started, bytes });
}
