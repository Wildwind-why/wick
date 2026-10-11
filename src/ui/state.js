/**
 * state.js — one small shared model.
 *
 * The bench (section 02) and the budget engine (section 03) are the same idea
 * seen twice, so they read the same message. Compose upstairs, watch the
 * arithmetic change downstairs.
 */

import { measure } from "../core/codec.js";

/** A shared session origin and epoch, exactly as two devices would agree once. */
export const SESSION = {
  epoch: 1760000000,
  origin: { lat: 31.2304, lon: 121.4737 },
};

export const state = {
  message: {
    type: "checkin",
    status: "safe",
    position: { ...SESSION.origin },
    time: SESSION.epoch + 42,
  },
  radioId: "lte",
  resourceId: "phone",
  levelPct: 1,
  batchSize: 1,
  eco: false,
  /** byte cost of the last transmission the offline demo made */
  lastTransmissionBytes: 0,
  /** running total of bytes this page has not had to send */
  bytesSaved: 0,
};

export const codecContext = () => ({
  origin: SESSION.origin,
  prevTime: SESSION.epoch,
});

const listeners = new Set();

export function onState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch, source = "unknown") {
  Object.assign(state, patch);
  for (const fn of listeners) fn(state, source);
}

export function measureCurrent() {
  return measure(state.message, codecContext());
}

/** The HUD shows the saving of the situation currently on screen, not a total. */
export function setBytesSaved(bytes) {
  const next = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  if (next === state.bytesSaved) return;
  state.bytesSaved = next;
  for (const fn of listeners) fn(state, "saved");
}
