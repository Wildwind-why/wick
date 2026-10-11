/**
 * codec.worker.js — bulk encoding, off the main thread.
 *
 * Encoding one message is microseconds of work, but a field radio relaying a
 * day of traffic is not one message. Anything that could block a frame runs
 * here instead, which is also why this page keeps a flat frame time while the
 * bench is proving how fast the codec is.
 */

import { encode } from "../core/codec.js";

self.addEventListener("message", (event) => {
  const { id, count = 10000, message, context = {} } = event.data || {};
  const started = performance.now();
  let bytes = 0;
  let failures = 0;

  for (let i = 0; i < count; i++) {
    try {
      const frame = encode({ ...message, time: (context.prevTime || 0) + (i % 86400) }, context);
      bytes += frame.bytes.length;
    } catch {
      failures += 1;
    }
  }

  self.postMessage({
    id,
    ms: performance.now() - started,
    frames: count - failures,
    bytes,
    failures,
  });
});
