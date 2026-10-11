/**
 * field.js — section 05.
 *
 * The scenario model, charted. Two lines: what wick can still send, and what
 * the baseline can still send, over the same outage process and the same
 * demand. The vertical marker is the hour the baseline stops being able to
 * speak at all.
 */

import { $, escapeHtml } from "./dom.js";
import { t } from "./i18n.js";
import { SCENARIOS, run } from "../core/sim.js";
import { formatCount, formatDuration, RESOURCES } from "../core/energy.js";

const CHART = { w: 1000, h: 430, pad: { top: 26, right: 34, bottom: 40, left: 62 } };
const BYTES = 12;
const NAIVE_BYTES = 340;

/**
 * Results are cached per scenario. The first one is computed on the main
 * thread so the panel is never empty; the Worker then warms the rest so
 * switching scenarios costs nothing at all.
 */
const cache = new Map();

/**
 * The last painted result, readable by anyone who arrived after it was
 * painted. Section 05 paints during boot; the share card mounts in the same
 * batch and would otherwise miss the only event it cares about, leaving the
 * export button dead until the visitor happened to switch scenarios.
 */
let lastDetail = null;

export function currentFieldResult() {
  return lastDetail;
}

export function initField() {
  const refs = {
    scenarios: $("#field-scenarios"),
    chart: $("#field-chart"),
    legend: $("#field-legend"),
    tag: $("#field-scenario-tag"),
    delivered: $("#field-delivered"),
    deliveredNote: $("#field-delivered-note"),
    wickAlive: $("#field-wick-alive"),
    naiveAlive: $("#field-naive-alive"),
    tx: $("#field-tx"),
    txNote: $("#field-tx-note"),
    table: $("#field-table"),
  };
  if (!refs.scenarios) return;

  let current = "quake";
  let worker = null;
  try {
    worker = new Worker(new URL("../workers/sim.worker.js", import.meta.url), { type: "module" });
  } catch {
    worker = null;
  }

  refs.scenarios.innerHTML = Object.values(SCENARIOS)
    .map(
      (scenario) =>
        `<button class="scenario" type="button" data-scenario="${scenario.id}" aria-pressed="false">` +
        `<span class="scenario__name">${escapeHtml(t(`sc.${scenario.id}.label`))}</span>` +
        `<span class="scenario__blurb">${escapeHtml(t(`sc.${scenario.id}.blurb`))}</span>` +
        `<span class="scenario__meta">${escapeHtml(
          t("c5.meta", {
            resource: RESOURCES[scenario.resourceId].label,
            hours: scenario.hours,
            uptime: Math.round(scenario.outageProfile.uptime * 100),
          }),
        )}</span></button>`,
    )
    .join("");

  refs.scenarios.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scenario]");
    if (!button) return;
    current = button.dataset.scenario;
    load();
  });

  document.addEventListener("wick:lang", () => {
    for (const button of refs.scenarios.children) {
      const id = button.dataset.scenario;
      button.querySelector(".scenario__name").textContent = t(`sc.${id}.label`);
      button.querySelector(".scenario__blurb").textContent = t(`sc.${id}.blurb`);
    }
    paint(refs, lastResult, current);
  });

  let lastResult = null;

  function load() {
    const scenario = SCENARIOS[current];
    for (const button of refs.scenarios.children) {
      button.setAttribute("aria-pressed", String(button.dataset.scenario === current));
    }
    if (refs.tag) refs.tag.textContent = t("c5.seed", { hours: scenario.hours, seed: scenario.seed });

    let result = cache.get(scenario.id);
    if (!result) {
      result = model(scenario);
      cache.set(scenario.id, result);
    }
    lastResult = result;
    paint(refs, result, scenario.id);
    suggestWorker(scenario.id);
  }

  function model(scenario) {
    const started = performance.now();
    const wick = run(scenario, { mode: "wick", bytes: BYTES, naiveBytes: NAIVE_BYTES });
    const naive = run(scenario, { mode: "naive", bytes: BYTES, naiveBytes: NAIVE_BYTES });
    return { wick, naive, ms: performance.now() - started };
  }

  /** Warm the scenarios that have not been modelled yet, off the main thread. */
  function suggestWorker(activeId) {
    if (!worker) return;
    for (const scenario of Object.values(SCENARIOS)) {
      if (scenario.id === activeId || cache.has(scenario.id)) continue;
      const id = Math.random().toString(36).slice(2);
      const handler = (event) => {
        if (event.data.id !== id) return;
        worker.removeEventListener("message", handler);
        cache.set(scenario.id, { wick: event.data.wick, naive: event.data.naive, ms: event.data.ms });
      };
      worker.addEventListener("message", handler);
      worker.postMessage({ id, scenario, bytes: BYTES, naiveBytes: NAIVE_BYTES });
    }
  }

  load();
}

function paint(refs, result, scenarioId) {
  if (!result || !result.wick) return;
  const wick = result.wick;
  const naive = result.naive;
  const scenario = SCENARIOS[scenarioId] || SCENARIOS.quake;

  refs.chart.innerHTML = lineChart(wick.series, naive.series, scenario);
  refs.legend.innerHTML =
    `<li><span class="legend__swatch" style="background:var(--ember)"></span>${escapeHtml(
      t("c5.wick"),
    )}<span class="legend__val">${formatCount(wick.summary.delivered)} ${escapeHtml(
      t("c5.delivered"),
    )}</span></li>` +
    `<li><span class="legend__swatch" style="background:var(--fig-naive)"></span>${escapeHtml(
      t("c5.naive"),
    )}<span class="legend__val">${formatCount(naive.summary.delivered)}</span></li>`;

  const ratio =
    naive.summary.delivered > 0 ? wick.summary.delivered / naive.summary.delivered : Infinity;
  refs.delivered.textContent = `${ratio.toFixed(2)}×`;
  refs.deliveredNote.textContent = `${formatCount(wick.summary.delivered)} vs ${formatCount(
    naive.summary.delivered,
  )}`;
  refs.wickAlive.textContent = formatDuration(wick.summary.aliveHours);
  refs.naiveAlive.textContent = formatDuration(naive.summary.aliveHours);
  refs.tx.textContent = `${formatCount(wick.summary.transmissions)} / ${formatCount(
    naive.summary.transmissions,
  )}`;
  refs.txNote.textContent = `${escapeHtml(t("c5.wick"))} / ${escapeHtml(t("c5.naive"))}`;
  if (refs.tag) {
    refs.tag.textContent = `${t("c5.seed", {
      hours: scenario.hours,
      seed: scenario.seed,
    })} · ${result.ms ? `${result.ms.toFixed(0)} ms` : "worker"}`;
  }

  /*
   * The chart, as text. A line chart is the fastest way for a sighted visitor
   * to see a crossing point and the slowest for anybody using a screen reader,
   * so the same series ship as a table in a <details>. Twelve samples is
   * enough to locate the crossing and short enough to actually read.
   */
  if (refs.table) {
    const total = Math.max(
      wick.series[wick.series.length - 1]?.minute || 1,
      naive.series[naive.series.length - 1]?.minute || 1,
    );
    const samples = 12;
    const at = (series, minute) => {
      let value = series.length ? series[0].chargePct : 0;
      for (const point of series) {
        if (point.minute <= minute) value = point.chargePct;
        else break;
      }
      return value;
    };
    const rows = Array.from({ length: samples + 1 }, (_, i) => {
      const minute = Math.round((total / samples) * i);
      return (
        `<tr><td>${formatDuration(minute)}</td>` +
        `<td>${at(wick.series, minute).toFixed(1)}%</td>` +
        `<td>${at(naive.series, minute).toFixed(1)}%</td></tr>`
      );
    }).join("");
    refs.table.innerHTML =
      `<table>` +
      `<caption>${escapeHtml(
        t("c5.charge") + " — " + t(`sc.${scenario.id}.label`),
      )}</caption>` +
      `<thead><tr><th scope="col">${escapeHtml(t("c5.table.elapsed"))}</th>` +
      `<th scope="col">${escapeHtml(t("c5.wick"))}</th>` +
      `<th scope="col">${escapeHtml(t("c5.naive"))}</th></tr></thead>` +
      `<tbody>${rows}</tbody></table>`;
  }

  // Whoever wants the result — the share card, the guided demo — listens here
  // instead of reaching into this module's internals.
  lastDetail = {
    scenarioId,
    label: t(`sc.${scenarioId}.label`),
    hours: scenario.hours,
    seed: scenario.seed,
    ratio,
    delivered: { wick: wick.summary.delivered, naive: naive.summary.delivered },
    alive: { wick: wick.summary.aliveHours, naive: naive.summary.aliveHours },
    transmissions: { wick: wick.summary.transmissions, naive: naive.summary.transmissions },
  };
  document.dispatchEvent(new CustomEvent("wick:field", { detail: lastDetail }));
}

function lineChart(wickSeries, naiveSeries, scenario) {
  const { w, h, pad } = CHART;
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const totalMinutes = Math.max(
    wickSeries[wickSeries.length - 1]?.minute || 1,
    naiveSeries[naiveSeries.length - 1]?.minute || 1,
  );

  const x = (minute) => pad.left + (minute / totalMinutes) * innerW;
  const y = (pct) => pad.top + (1 - Math.min(100, Math.max(0, pct)) / 100) * innerH;

  const path = (series) =>
    series
      .map((point, i) => `${i === 0 ? "M" : "L"}${x(point.minute).toFixed(1)} ${y(point.chargePct).toFixed(1)}`)
      .join(" ");

  const wickPath = path(wickSeries);
  const areaPath = `${wickPath} L${x(totalMinutes).toFixed(1)} ${y(0).toFixed(1)} L${pad.left} ${y(0).toFixed(1)} Z`;

  const dead = naiveSeries.find((point) => point.chargePct <= 0.01);

  const gridLines = [0, 25, 50, 75, 100]
    .map((pct) => {
      const yy = y(pct);
      return (
        `<line class="grid-line" x1="${pad.left}" y1="${yy.toFixed(1)}" x2="${w - pad.right}" y2="${yy.toFixed(
          1,
        )}"/>` +
        `<text x="${pad.left - 12}" y="${(yy + 3.5).toFixed(1)}" text-anchor="end">${pct}%</text>`
      );
    })
    .join("");

  const hourTicks = 6;
  const xTicks = Array.from({ length: hourTicks + 1 }, (_, i) => {
    const minute = (totalMinutes / hourTicks) * i;
    return `<text x="${x(minute).toFixed(1)}" y="${h - 14}" text-anchor="middle">${Math.round(
      minute / 60,
    )} h</text>`;
  }).join("");

  const marker = dead
    ? `<line class="marker" x1="${x(dead.minute).toFixed(1)}" y1="${pad.top}" x2="${x(
        dead.minute,
      ).toFixed(1)}" y2="${y(0).toFixed(1)}"/>` +
      `<text class="marker-label" x="${(x(dead.minute) + 8).toFixed(1)}" y="${
        pad.top + 14
      }">${escapeHtml(t("c5.dead", { h: Math.round(dead.minute / 60) }))}</text>`
    : "";

  return (
    `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeHtml(
      `${t("c5.charge")} — ${t(`sc.${scenario?.id || "quake"}.label`)}`,
    )}">` +
    `<defs><linearGradient id="wickGrad" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="rgba(255,122,51,0.22)"/>` +
    `<stop offset="100%" stop-color="rgba(255,122,51,0)"/></linearGradient></defs>` +
    gridLines +
    `<line class="axis-line" x1="${pad.left}" y1="${y(0)}" x2="${w - pad.right}" y2="${y(0)}"/>` +
    `<path class="wick-area" d="${areaPath}"/>` +
    `<path class="wick-line" d="${wickPath}"/>` +
    `<path class="naive-line" d="${path(naiveSeries)}"/>` +
    marker +
    xTicks +
    `</svg>`
  );
}
