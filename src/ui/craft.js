/**
 * craft.js — section 07.
 *
 * The accounting: how the code is layered, what each file is for, what it
 * weighs, what was measured rather than claimed, who the neighbours are, and
 * what this project deliberately does not do.
 */

import { $, escapeHtml } from "./dom.js";
import { t, nf } from "./i18n.js";
import { ARCH, FILES, COMPARE, A11Y, PERF } from "./craft-data.js";
import { BUDGET, MEASURED } from "./budget-data.js";

export function initCraft() {
  const arch = $("#craft-arch");
  const files = $("#craft-files");
  const budget = $("#craft-budget");
  const compare = $("#craft-compare");
  const a11y = $("#craft-a11y");
  const perf = $("#craft-perf");

  const render = () => {
    if (arch) {
      arch.innerHTML = ARCH.map(
        (layer) =>
          `<div class="arch__layer"><h5>${escapeHtml(t(layer.title))}</h5><ul>` +
          layer.items
            .map(
              (item) =>
                `<li>${escapeHtml(item.name)}<span>${escapeHtml(item.note)}</span></li>`,
            )
            .join("") +
          `</ul></div>`,
      ).join("");
    }

    if (files) {
      files.innerHTML = FILES.map(
        (file) =>
          `<li><code>${escapeHtml(file.path)}</code><span>${escapeHtml(file.note)}</span></li>`,
      ).join("");
    }

    if (budget) {
      const rows = BUDGET.map(
        (row) =>
          `<tr><td>${escapeHtml(row.name)}</td><td>${nf(row.raw)} B</td><td>${nf(
            row.gzip,
          )} B</td><td>${row.share.toFixed(1)}%</td></tr>`,
      ).join("");
      budget.innerHTML =
        `<caption class="visually-hidden">Measured payload sizes, gzip</caption>` +
        `<thead><tr><th>asset</th><th>raw</th><th>gzip</th><th>share</th></tr></thead>` +
        `<tbody>${rows}` +
        `<tr class="is-total"><td>critical path total</td><td>${nf(
          MEASURED.totalRaw,
        )} B</td><td>${nf(MEASURED.totalGzip)} B</td><td>100%</td></tr></tbody>`;
    }

    const ecoNote = $("#craft-budget-eco");
    if (ecoNote) {
      ecoNote.textContent = t("c7.budget.eco", {
        kb: (MEASURED.withoutFontsGzip / 1024).toFixed(1),
      });
    }

    if (compare) {
      compare.innerHTML = COMPARE.map(
        (entry) =>
          `<li><span class="compare__tag">${escapeHtml(entry.tag)}</span>` +
          `<b>${escapeHtml(t(entry.title))}</b><p>${escapeHtml(t(entry.body))}</p></li>`,
      ).join("");
    }

    if (a11y) {
      a11y.innerHTML = A11Y.map((key) => `<li>${escapeHtml(t(key))}</li>`).join("");
    }
    if (perf) {
      perf.innerHTML = PERF.map((key) => `<li>${escapeHtml(t(key))}</li>`).join("");
    }
  };

  render();
  document.addEventListener("wick:lang", render);
}
