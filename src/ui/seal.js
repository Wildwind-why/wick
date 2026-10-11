/**
 * seal.js — section 02b. The receipt for confidentiality.
 *
 * The bench above shows what a message costs to *send*. This panel shows what
 * it costs to send it *privately*: the algorithm id, the nonce tail, the tag,
 * and the four bytes of overhead that come with them. Nothing here is a
 * mock-up — pressing "seal" runs the same frame from the bench through
 * `src/core/secure.js`, and pressing "flip one bit" runs a real forgery
 * attempt through `openFrame()` and reports the exception.
 *
 * The session key below is a demo key, printed in full so that anyone can
 * reproduce this by hand in a console. A real deployment exchanges it offline;
 * this module never pretends the demo key is secret.
 */

import { $, escapeHtml } from "./dom.js";
import { t, nf } from "./i18n.js";
import { measureCurrent, onState } from "./state.js";
import { sealFrame, openFrame, keyFromHex, toHex, wireBreakdown, SEAL_OVERHEAD } from "../core/secure.js";

/** Printed, not hidden: this is a demonstration session key. */
const DEMO_KEY_HEX = "7e1f0a4c9b2d5380e6a71c4f8b0d2935647ac1e8039f2b6d4a8e0c5173fb9d26";
const SESSION_TAG = new Uint8Array([0x77, 0x69, 0x63, 0x6b]); // "wick"

/** `data-group` values map onto the byte colours already defined in app.css. */
const GROUP_FOR = {
  plain: "token",
  alg: "header",
  nonce: "time",
  tag: "integrity",
};

export function initSeal() {
  const refs = {
    hex: $("#seal-hex"),
    out: $("#seal-out"),
    receipt: $("#seal-receipt"),
    counter: $("#seal-counter"),
    run: $("#seal-run"),
    tamper: $("#seal-tamper"),
    replay: $("#seal-replay"),
  };
  if (!refs.hex || !refs.run) return;

  const key = keyFromHex(DEMO_KEY_HEX);
  const sealer = { sessionTag: SESSION_TAG, counter: 0n };
  let lastSealed = null;
  let lastCounter = 0n;

  const bytesOf = () => {
    const measurement = measureCurrent();
    return measurement && measurement.bytes ? measurement.bytes : new Uint8Array(0);
  };

  const paint = (bytes, groups) => {
    refs.hex.innerHTML = Array.from(bytes)
      .map((byte, i) => {
        const group = groups ? groups(i) : "plain";
        return (
          `<span class="byte is-hi" data-group="${GROUP_FOR[group] || "header"}">` +
          `<b>${byte.toString(16).toUpperCase().padStart(2, "0")}</b>` +
          `<i>${escapeHtml(t(`c1.seal.${group}`))}</i></span>`
        );
      })
      .join("");
  };

  /**
   * The receipt. Four bars whose widths are real byte counts, so the 25 bytes
   * of overhead are visible rather than described.
   */
  const renderReceipt = (plaintextBytes) => {
    if (!refs.receipt) return;
    const rows = wireBreakdown(plaintextBytes);
    const total = rows[rows.length - 1].bytes;
    refs.receipt.innerHTML = rows
      .map(
        (row) =>
          `<li data-key="${row.kind}">` +
          `<span class="legend__swatch" style="background:rgba(${
            row.kind === "seal" ? "255,122,51" : row.kind === "total" ? "237,237,242" : "134,182,255"
          },0.85)"></span>` +
          `${escapeHtml(t(row.label))}<span class="legend__val">${nf(row.bytes)} B · ${(
            (row.bytes / total) *
            100
          ).toFixed(0)}%</span></li>`,
      )
      .join("");
    if (refs.counter) {
      refs.counter.textContent = `${t("c2.seal.counter")} · ${lastCounter.toString()} · ${t(
        "c2.seal.alg",
      )}`;
    }
  };

  const say = (message, ok) => {
    if (!refs.out) return;
    refs.out.textContent = message;
    refs.out.dataset.state = ok ? "ok" : "bad";
  };

  const sealCurrent = () => {
    const frame = bytesOf();
    if (!frame.length) {
      say("—", false);
      return;
    }
    lastCounter = BigInt(sealer.counter);
    lastSealed = sealFrame(frame, key, sealer);

    const plainLength = frame.length;
    paint(lastSealed, (i) => {
      if (i < plainLength) return "plain";
      if (i === plainLength) return "alg";
      if (i < plainLength + 1 + 8) return "nonce";
      return "tag";
    });
    renderReceipt(plainLength);

    // Open it again straight away: a seal you never verified is a claim.
    const opener = { sessionTag: SESSION_TAG, counter: lastCounter };
    const reopened = openFrame(lastSealed, key, opener);
    const identical = toHex(reopened.plaintext) === toHex(frame);
    say(
      identical
        ? `${t("c2.seal.roundtrip.ok")} · ${lastSealed.length} B = ${plainLength} + ${SEAL_OVERHEAD}`
        : `${t("c2.seal.roundtrip.bad")} · ${lastSealed.length} B`,
      identical,
    );
  };

  const flipOneBit = () => {
    if (!lastSealed) {
      sealCurrent();
      if (!lastSealed) return;
    }
    const forged = lastSealed.slice();
    forged[forged.length - 1] ^= 0x01; // the last byte of the Poly1305 tag
    paint(forged, (i) => (i < lastSealed.length - 16 ? "plain" : "tag"));
    try {
      openFrame(forged, key, { sessionTag: SESSION_TAG, counter: lastCounter });
      say(`${t("c2.seal.roundtrip.ok")} — which should be impossible`, false);
    } catch (error) {
      say(`${t("c2.seal.roundtrip.bad")} · ${error.message}`, true);
    }
  };

  const replay = () => {
    if (!lastSealed) {
      sealCurrent();
      if (!lastSealed) return;
    }
    try {
      // A fresh reader that has already accepted this counter.
      const reader = { sessionTag: SESSION_TAG, counter: lastCounter + 1n };
      openFrame(lastSealed, key, reader);
      say(`${t("c2.seal.roundtrip.ok")} — which should be impossible`, false);
    } catch (error) {
      say(`${t("c2.seal.replay.bad")} · ${error.message}`, true);
    }
  };

  refs.run.addEventListener("click", sealCurrent);
  refs.tamper?.addEventListener("click", flipOneBit);
  refs.replay?.addEventListener("click", replay);

  // Follow the bench: change the message and the sealed frame follows.
  onState(() => {
    if (lastSealed) sealCurrent();
  });

  document.addEventListener("wick:lang", () => {
    if (lastSealed) sealCurrent();
  });

  sealCurrent();
}
