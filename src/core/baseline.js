/**
 * baseline.js — the honest yardstick.
 *
 * A byte count only means something next to the thing it replaces. So for
 * every wick message we build the *same* message the way a mainstream
 * messenger would put it on the wire, and count that too.
 *
 * The model is deliberately explicit and shown in the UI, because a comparison
 * you cannot audit is marketing, not engineering:
 *
 *   payload   a realistic JSON envelope (ids, transport metadata, ack flags)
 *           + the framing a phone actually pays per message:
 *   +21 B   TLS 1.3 record header + AEAD tag
 *   +40 B   IPv4 + TCP headers
 *   +9 B    HTTP/2 frame header
 *   +30 B   amortised share of keepalive / push-channel traffic per message
 *
 * Figures are estimates for a modern encrypted mobile messenger on a single
 * un-batched send. They are declared as such in the UI and the README.
 *
 * Pure module.
 */

export const FRAMING = {
  tlsRecord: 21,
  tcpIp: 40,
  http2: 9,
  signalling: 30,
  /** any IP radio pays TLS + TCP/IP, once per transmission */
  get transport() {
    return this.tlsRecord + this.tcpIp;
  },
  /** a mainstream messenger additionally pays an HTTP/2 frame and keepalive */
  get naiveExtra() {
    return this.http2 + this.signalling;
  },
};

/**
 * Framing is not the same on every radio, and pretending otherwise would
 * flatter wick for the wrong reason.
 *
 *   IP radios (LTE, 2G)  every transmission carries TLS + TCP/IP; a mainstream
 *                        messenger pays an extra HTTP/2 frame and a share of
 *                        its keepalive traffic. wick pays transport only.
 *   raw radios (LoRa, BLE, SBD)  there is no IP stack at all, so there is no
 *                        framing to amortise — only bytes.
 */
export function framingFor(radioId) {
  const ipBased = radioId === "lte" || radioId === "gsm";
  return {
    ipBased,
    wick: ipBased ? FRAMING.transport : 0,
    naive: ipBased ? FRAMING.transport + FRAMING.naiveExtra : 0,
  };
}

/** Largest payload each raw radio can carry in a single frame, in bytes. */
export const FRAME_LIMIT = {
  lora: 255,
  ble: 244,
  satellite: 340, // Iridium SBD mobile-originated message
};

const utf8 = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

export function byteLength(text) {
  if (utf8) return utf8.encode(text).length;
  // conservative fallback for very old runtimes
  return unescape(encodeURIComponent(text)).length;
}

/**
 * The envelope a mainstream chat app ships for the same fact.
 * Fixed-width by design: that is exactly the waste wick removes.
 */
export function naiveEnvelope(message) {
  const body =
    message.type === "sitrep"
      ? message.text || ""
      : message.type === "need"
        ? `need ${message.need}`
        : message.type === "checkin"
          ? `status ${message.status}`
          : message.type;

  return {
    id: "01JQ8Z3K7M2XR9T4V6B1N5C0DW",
    thread_id: "thr_9f21c4a7",
    sender: "+8613800138000",
    client_seq: 4193,
    sent_at: Math.round((message.time ?? 1760000000) * 1000),
    kind: message.type,
    body,
    geo: message.position
      ? {
          lat: Number(message.position.lat.toFixed(6)),
          lon: Number(message.position.lon.toFixed(6)),
        }
      : null,
    urgency: message.urgency ?? null,
    ack_required: true,
    schema: "v3",
  };
}

/** Whole-message cost as a mainstream messenger would send it. */
export function naiveWire(message, radioId = "lte") {
  const payload = byteLength(JSON.stringify(naiveEnvelope(message)));
  const framing = framingFor(radioId);
  return {
    payload,
    framing: framing.naive,
    total: payload + framing.naive,
    fitsFrame:
      FRAME_LIMIT[radioId] === undefined ? true : payload <= FRAME_LIMIT[radioId],
    frameLimit: FRAME_LIMIT[radioId],
  };
}

/**
 * Store-and-forward changes the arithmetic: when the link is back, wick drains
 * the whole outbox in one transmission, so the fixed framing cost is paid once
 * and split across every message in the batch.
 */
export function batched(bytesPerMessage, count, framingBytes = 0) {
  if (count <= 0) return framingBytes;
  return (bytesPerMessage * count + framingBytes) / count;
}
