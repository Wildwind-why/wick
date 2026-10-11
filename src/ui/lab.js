/**
 * lab.js — section 03, the power budget engine.
 *
 * Six controls, four answers, one ranking. The point of the ranking is that
 * "faster" and "cheaper" are different questions, and at 1% only one of them
 * is being asked.
 */

import { $, on, escapeHtml } from "./dom.js";
import { t, nf } from "./i18n.js";
import { RADIOS, RESOURCES, formatDuration, formatJoules, formatCount } from "../core/energy.js";
import { compare, rankRadios, ECO_TRIMMING } from "../core/budget.js";
import { onState, state, setState, codecContext } from "./state.js";

export function initLab() {
  const refs = {
    resources: $("#lab-resources"),
    radios: $("#lab-radios"),
    level: $("#lab-level"),
    levelVal: $("#lab-level-val"),
    batch: $("#lab-batch"),
    batchVal: $("#lab-batch-val"),
    eco: $("#lab-eco"),
    msgs: $("#lab-msgs"),
    msgsNote: $("#lab-msgs-note"),
    hours: $("#lab-hours"),
    hoursNote: $("#lab-hours-note"),
    per: $("#lab-per"),
    perNote: $("#lab-per-note"),
    advantage: $("#lab-advantage"),
    saved: $("#lab-saved"),
    splitFixed: $("#lab-split-fixed"),
    splitLinear: $("#lab-split-linear"),
    splitLegend: $("#lab-split-legend"),
    radioNote: $("#lab-radio-note"),
    rank: $("#lab-rank"),
    trim: $("#lab-trim"),
  };
  if (!refs.level) return;

  refs.resources.innerHTML = Object.values(RESOURCES)
    .map(
      (resource) =>
        `<button type="button" data-resource="${resource.id}" title="${escapeHtml(
          resource.detail,
        )}">${escapeHtml(resource.label)}</button>`,
    )
    .join("");

  refs.radios.innerHTML = Object.values(RADIOS)
    .map(
      (radio) =>
        `<button type="button" data-radio="${radio.id}" title="${escapeHtml(radio.note)}">${escapeHtml(
          radio.short,
        )}</button>`,
    )
    .join("");

  refs.trim.innerHTML = ECO_TRIMMING.map(
    (item) => `<li><b>${escapeHtml(item.label)}</b><em>${escapeHtml(item.reason)}</em></li>`,
  ).join("");

  on(refs.resources, "click", "[data-resource]", (_, el) =>
    setState({ resourceId: el.dataset.resource }, "lab"),
  );
  on(refs.radios, "click", "[data-radio]", (_, el) =>
    setState({ radioId: el.dataset.radio }, "lab"),
  );
  refs.level.addEventListener("input", () =>
    setState({ levelPct: Number(refs.level.value) }, "lab"),
  );
  refs.batch.addEventListener("input", () =>
    setState({ batchSize: Number(refs.batch.value) }, "lab"),
  );
  refs.eco.addEventListener("change", () => {
    setState({ eco: refs.eco.checked }, "lab");
    if (refs.eco.checked) document.documentElement.dataset.ecoTrim = "on";
    else delete document.documentElement.dataset.ecoTrim;
  });

  const render = () => {
    const { resourceId, radioId, levelPct, batchSize, eco } = state;

    refs.level.value = String(levelPct);
    refs.batch.value = String(batchSize);
    refs.levelVal.textContent = `${levelPct}%`;
    refs.batchVal.textContent = nf(batchSize);
    refs.eco.checked = eco;

    for (const button of refs.resources.children) {
      button.setAttribute("aria-pressed", String(button.dataset.resource === resourceId));
    }
    for (const button of refs.radios.children) {
      button.setAttribute("aria-pressed", String(button.dataset.radio === radioId));
    }

    const result = compare({
      message: state.message,
      context: codecContext(),
      resourceId,
      levelPct,
      radioId,
      batchSize,
      eco,
    });

    const radio = RADIOS[radioId];
    const resource = RESOURCES[resourceId];

    refs.msgs.textContent = formatCount(result.wick.sim.messages);
    refs.msgsNote.textContent = `${eco ? "1% mode" : "full frame"} · ${radio.short} · ${resource.label}`;
    refs.hours.textContent = formatDuration(result.wick.sim.hours);
    const simHours = result.wick.sim;
    const txShare = simHours.drainPerHour > 0 ? 1 - simHours.dutyShare : 0;
    refs.hoursNote.textContent =
      `${nf(result.wick.wireBytes)} B/message · ${t("c3.drain", {
        tx: Math.round((1 - txShare) * 100),
        idle: Math.round(txShare * 100),
      })}`;
    refs.per.textContent = formatJoules(result.wick.sim.perMessageJ);
    refs.perNote.textContent = `${formatJoules(result.wick.sim.fixedJ)} wake + ${formatJoules(
      result.wick.sim.linearJ,
    )} bytes`;
    refs.advantage.textContent = `${result.advantage.toFixed(1)}×`;
    refs.saved.textContent = `${nf(Math.round(result.bytesSavedPerMessage))} B saved · ${(
      result.bytesSavedPct * 100
    ).toFixed(0)}%`;

    const sim = result.wick.sim;
    const fixedShare = sim.perMessageJ > 0 ? sim.fixedJ / sim.perMessageJ : 0;
    refs.splitFixed.style.width = `${(fixedShare * 100).toFixed(1)}%`;
    refs.splitLinear.style.width = `${((1 - fixedShare) * 100).toFixed(1)}%`;
    refs.splitLegend.innerHTML =
      `<li><span class="legend__swatch" style="background:var(--ember)"></span>${escapeHtml(
        t("c3.fixed"),
      )}<span class="legend__val">${formatJoules(sim.fixedJ)}</span></li>` +
      `<li><span class="legend__swatch" style="background:var(--signal)"></span>${escapeHtml(
        t("c3.linear"),
      )}<span class="legend__val">${formatJoules(sim.linearJ)}</span></li>`;

    refs.radioNote.textContent = `${radio.reachable} · ${radio.band} · ${radio.rangeM >= 1e6 ? "global" : `${nf(radio.rangeM)} m`}.`;

    paintRank(refs, result);
  };

  onState((_, source) => {
    if (source === "lab") return;
    render();
  });
  render();
}

function paintRank(refs, result) {
  const ranked = rankRadios({
    // Same byte basis as the headline readout: per-message bytes with framing
    // already amortised across the batch, and the fixed cost amortised here.
    bytes: Math.max(2, result.wick.batchedBytes),
    resourceId: state.resourceId,
    levelPct: state.levelPct,
    batchSize: state.batchSize,
  });
  const max = Math.max(...ranked.map((r) => (Number.isFinite(r.messages) ? r.messages : 0)), 1);

  refs.rank.innerHTML = ranked
    .map((entry, index) => {
      const value = Number.isFinite(entry.messages) ? entry.messages : max;
      const width = Math.max(3, (value / max) * 100);
      const best = index === 0;
      const baselineFits =
        entry.radio.id === "lte" || entry.radio.id === "gsm" || 0;
      void baselineFits;
      return (
        `<div class="rank__row${best ? " is-best" : ""}${value / max < 0.02 ? " is-dim" : ""}">` +
        `<span class="rank__name">${escapeHtml(entry.radio.short)}</span>` +
        `<span class="rank__track"><span class="rank__bar" style="width:${width.toFixed(1)}%"></span></span>` +
        `<span class="rank__val">${formatCount(entry.messages)}</span></div>`
      );
    })
    .join("");
}
