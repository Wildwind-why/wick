/** English copy. See i18n.js for the binding rules. */
export default {
  "meta.title": "wick — communication for the last 1%",
  "meta.desc":
    "An offline-first radio messenger that treats every byte, every joule and every second of signal as a budget. Built for when almost nothing is left.",

  "brand.sub": "1% Battery",

  "nav.story": "Cost",
  "nav.codec": "Codec",
  "nav.budget": "Budget",
  "nav.offline": "Offline",
  "nav.field": "Field",
  "nav.impact": "Impact",
  "nav.craft": "Craft",

  "eco.label": "1% mode",
  "eco.title": "Strip this website down to its essentials",
  "lang.title": "Switch language",
  "skip": "Skip to content",

  "tel.signal": "signal",
  "tel.charge": "site charge",
  "tel.saved": "bytes saved",
  "tel.frame": "frame",
  "tel.online": "online",
  "tel.offline": "no link",

  "hero.eyebrow": "1% Battery · Engineering & Social Impact",
  "hero.q": "How far can 1% go?",
  "hero.title": "Communication for when almost nothing is left.",
  "hero.lead":
    "When the grid fails, the network fails first — and the battery fails last. wick is an offline-first radio messenger that treats every byte, every joule and every second of signal as something you spend. It is built for the moment a message matters more than the device carrying it.",
  "hero.cta1": "Open the codec bench",
  "hero.cta2": "Turn on 1% mode",
  "hero.scroll": "Scroll to spend the charge",
  "hero.note":
    "This page is on a budget too. The rail on the left drains from 100% to 1% as you descend.",

  "stat.bytes.k": "bytes per check-in",
  "stat.msgs.k": "check-ins on 1% of a phone",
  "stat.net.k": "network required",
  "stat.net.v": "none",
  "stat.deps.k": "runtime dependencies",
  "stat.deps.v": "0",

  "c1.idx": "01 — the problem",
  "c1.title": "A sentence should not cost a connection.",
  "c1.lead":
    "To say “I’m safe”, a mainstream encrypted messenger spends a few hundred bytes before it has delivered a single word of it. Almost none of that is your message — it is the machinery around it.",
  "c1.naive": "A mainstream messenger",
  "c1.wick": "wick",
  "c1.batch": "Messages waiting in the outbox",
  "c1.batch.hint":
    "Framing is paid once per transmission, not once per message. This is where the fixed cost disappears.",
  "c1.take":
    "The same fact, on a fraction of the wire — and in one transmission instead of one per message.",
  "c1.legend.payload": "JSON envelope",
  "c1.legend.tls": "TLS",
  "c1.legend.tcp": "TCP/IP",
  "c1.legend.h2": "HTTP/2",
  "c1.legend.keep": "keepalive share",
  "c1.legend.header": "header",
  "c1.legend.token": "dictionary token",
  "c1.legend.pos": "position",
  "c1.legend.time": "time",
  "c1.legend.crc": "CRC-8",
  "c1.legend.text": "literal text",
  "c1.bytes": "bytes",
  "c1.permsg": "per message",
  "c1.total": "whole outbox",
  "c1.tx.one": "1 transmission",
  "c1.tx.many": "1 transmission / {n} messages",

  "c2.idx": "02 — the codec",
  "c2.title": "Every word you need, in one byte.",
  "c2.lead":
    "wick does not compress prose after writing it — it declines to write prose at all. 126 words that emergency traffic actually uses get one-byte codes. Anything outside the dictionary is packed six bits to a character. A position fix travels as an 11 m delta from a known origin. A CRC-8 rides along, so a garbled frame is rejected without asking the network for anything.",
  "c2.compose": "Compose",
  "c2.type": "Message type",
  "c2.status": "Status",
  "c2.need": "Resource needed",
  "c2.urgency": "Urgency",
  "c2.text": "Free text",
  "c2.text.placeholder": "trapped in school, 12 children, send help",
  "c2.pos": "Include position fix",
  "c2.time": "Include timestamp",
  "c2.presets": "Try",
  "c2.frame": "Frame",
  "c2.frame.hint": "Every byte is owned by a field. Nothing is wasted on padding.",
  "c2.decoded": "Decoded on the other side",
  "c2.integrity": "Integrity",
  "c2.ok": "round-trip verified",
  "c2.fail": "round-trip failed",
  "c2.size": "frame size",
  "c2.saved": "vs a mainstream envelope",
  "c2.energy": "energy per message",
  "c2.eff": "payload bytes",
  "c2.normalise":
    "wick transmits lower-case, single-spaced emergency text on purpose: it removes ambiguity and it removes bytes.",
  "c2.worker": "Encoded off the main thread in a Web Worker.",
  "c2.burst": "Encode 20 000 frames",
  "c2.eff.note": "header excluded",

  "c3.idx": "03 — the budget",
  "c3.title": "1% is a budget, not a metaphor.",
  "c3.lead":
    "Say what you have left. The engine splits every transmission into a fixed wake-up cost and a per-byte cost, then reports what the remaining charge still buys — on each radio, because the answer changes completely.",
  "c3.resource": "Energy store",
  "c3.level": "Charge remaining",
  "c3.radio": "Radio",
  "c3.batch": "Outbox batch",
  "c3.eco": "1% mode",
  "c3.eco.hint": "Product policy: drop position, time and prose. Keep the fact.",
  "c3.msgs": "messages still affordable",
  "c3.hours": "time to empty",
  "c3.per": "cost per message",
  "c3.split": "fixed wake-up vs per-byte",
  "c3.fixed": "wake-up",
  "c3.linear": "per byte",
  "c3.rank": "The same charge, on every radio",
  "c3.rank.note":
    "Ranked by messages delivered, not by throughput. A radio that is fast and expensive is useless at 1%.",
  "c3.rank.note2":
    "A mainstream messenger cannot place a single one of its messages into a raw radio frame. That gap is not a tuning problem.",
  "c3.trim.title": "What 1% mode gives up, and why",
  "c3.trim.note":
    "Dropping is a product decision, so it is written down rather than hidden. The first thing given up is the thing whose loss hurts least.",
  "c3.trim.site":
    "The same discipline is applied to this page: the 1% mode switch in the header strips the site itself — no fonts, no grain, no motion — and says so while it does it.",
  "c3.est":
    "Energy coefficients are illustrative estimates built on public measurements of mobile radio behaviour and typical duty cycles. They are declared as estimates, not datasheet values.",
  "c3.duty": "at 6 messages / hour",
  "c3.drain": "{tx}% sending · {idle}% standby",
  "c1.raw":
    "On a raw radio there is no IP framing to amortise, so the win is the frame itself — {raw}× smaller than the same message in a mainstream envelope. That ratio is what decides whether a message fits in a LoRa or BLE frame at all.",

  "c4.idx": "04 — offline",
  "c4.title": "Offline is not a failure state.",
  "c4.lead":
    "Writing a message never needs a network. It needs a queue. Compose with no signal, watch it persist, and watch the whole outbox leave in a single transmission the moment a link appears.",
  "c4.compose": "Compose",
  "c4.placeholder": "need water at sector 4",
  "c4.queue": "Queue it",
  "c4.outbox": "Outbox",
  "c4.empty": "Nothing waiting.",
  "c4.link": "Link",
  "c4.send": "Try to send",
  "c4.clear": "Clear outbox",
  "c4.queued": "queued",
  "c4.sending": "sending",
  "c4.sent": "sent",
  "c4.failed": "waiting for signal",
  "c4.nothing": "No link. The message stays on the device — that is the whole design.",
  "c4.batched": "transmission carried",
  "c4.real": "This is a real offline app",
  "c4.real.body":
    "A service worker caches this shell on your device. Turn off Wi-Fi, reload, and the page comes back with your outbox intact. The row below reports what it actually did — check it before you trust the sentence above.",
  "c4.sw": "service worker",
  "c4.sw.pending": "checking…",
  "c4.sw.active": "active · shell cached",
  "c4.sw.registered": "registered · cache unconfirmed",
  "c4.sw.partial": "registered · cache incomplete",
  "c4.sw.absent": "no worker registered here yet",
  "c4.sw.none": "unavailable in this context",
  "c4.store": "local store",
  "c4.store.idb": "IndexedDB",
  "c4.store.mem": "in-memory fallback",

  "c5.idx": "05 — the field",
  "c5.title": "Play it forward.",
  "c5.lead":
    "A minute-by-minute model of one team in the field: demand on a day–night cycle, outages that arrive whether or not you are ready, and the energy it takes to answer. Every scenario below is a declared simulation, not field data.",
  "c5.charge": "charge over time",
  "c5.delivered": "messages delivered",
  "c5.wick": "wick",
  "c5.naive": "mainstream messenger",
  "c5.uptime": "link available",
  "c5.ratio": "wick delivered",
  "c5.wickAlive": "wick survived",
  "c5.naiveAlive": "baseline survived",
  "c5.tx": "transmissions",
  "c5.note":
    "Deterministic model · seeded · runs in a Web Worker so the page never stutters.",
  "c5.declare":
    "Declared simulation. The outage process, demand curve and energy coefficients are constructed for demonstration.",
  "c5.dead": "baseline silent at {h} h",
  "c5.seed": "{hours} h · seed {seed}",
  "c5.meta": "{resource} · {hours} h · link available {uptime}%",

  "c6.idx": "06 — who it is for",
  "c6.title": "The message that has to arrive.",
  "c6.lead":
    "wick is not a social network for bad days. It is the smallest tool that still works when the map has stopped being true.",
  "c6.map": "Signal at the edge of a disaster",
  "c6.map.note":
    "Illustrative. Hops are drawn between fixed points to show the idea, not to claim coverage.",
  "c6.declare":
    "All people, places, numbers and coverage shown in this section are illustrative constructions for demonstration. No real person, location or message is represented, and nothing here claims that a route is safe or accessible.",

  "c7.idx": "07 — how it is built",
  "c7.title": "Small on purpose.",
  "c7.lead":
    "A 1% project cannot ship a 3 MB framework. wick is plain ES modules, a static file server and nothing else — which is also why it can be audited, read and kept running for years.",
  "c7.arch": "Architecture",
  "c7.arch.note":
    "Pure core logic, a thin rendering layer, and a Worker thread for anything that could block a frame.",
  "c7.files": "Core files",
  "c7.budget": "Budget, measured",
  "c7.budget.note":
    "Measured on the shipped build, not estimated; the third column is gzip, except for the WOFF2 fonts, which are already compressed and so cannot shrink further. Reproduce it with tools/build-budget-data.py.",
  "c7.budget.eco":
    "Without the typefaces, everything you are reading is {kb} KB delivered. 1% mode requests no font bytes at all — the page you are looking at is its own demonstration.",
  "c7.a11y": "Accessibility",
  "c7.perf": "Performance",
  "c7.ethos": "Boundaries",
  "c7.compare": "Closest existing work, and what wick adds",
  "c7.compare.note":
    "Similarity is not a fault. Failing to say how you differ is. Here is the honest accounting.",
  "c7.ai": "How AI was used",
  "c7.ai.note":
    "Declared in full in AI_USAGE.md, including what was written by hand and where the models were wrong.",
  "c7.sim": "What is simulated",
  "c7.sim.note":
    "Everything that would require real university or field data is generated, and labelled as generated wherever it appears.",

  "c7.arch.core": "core · pure logic",
  "c7.arch.app": "ui · one region each",
  "c7.arch.workers": "workers · off the main thread",
  "c7.arch.edge": "edge · shell and type",

  "c7.cmp1.title": "Briar, Bridgefy and the mesh messengers",
  "c7.cmp1.body":
    "These are the closest neighbours and they solve the transport problem well: they move traffic over Bluetooth or Wi-Fi Direct with no infrastructure. wick does not replace that transport. It sits above it and answers the question they leave open — what a message should weigh. A 340-byte JSON envelope cannot cross a LoRa frame at all; a 9-byte wick frame can, and that changes which radios are usable.",
  "c7.cmp2.title": "Emergency SMS and cell broadcast",
  "c7.cmp2.body":
    "Government alerting reaches many people quickly, but it is one-way, requires working towers and backup power, and it cannot tell you that your neighbour is safe. wick is the other direction: small, two-way and survivable when the tower is on its last hour.",
  "c7.cmp3.title": "Cost-aware messaging, and a budget engine you can argue with",
  "c7.cmp3.body":
    "Every message carries and displays its own byte and joule cost, and the engine ranks radios by messages-delivered rather than throughput. 1% mode then makes the trade-off explicit in product terms: it drops position, time and prose, and says so, because a receiver who knows what you need can act while a receiver who knows where you were cannot.",
  "c7.cmp4.title": "What it refuses to do",
  "c7.cmp4.body":
    "No location history, no contact scraping, no facial recognition, no ranking of people, no claim that any route is safe, and no pretending that a simulation is field data. Those are not limitations to be apologised for; they are the reason the tool can be trusted in the situation it is built for.",

  "c7.a11y.1":
    "Body text sits between 12:1 and 15:1 contrast on the dark plane; interactive labels never fall below 4.5:1.",
  "c7.a11y.2":
    "Every control is reachable and operable from the keyboard, with a visible focus ring and a skip link ahead of the chrome.",
  "c7.a11y.3":
    "prefers-reduced-motion removes reveals, the ember trace and every ambient animation, and renders the chart statically.",
  "c7.a11y.4":
    "Charts and the network diagram are described in text as well as drawn; the hex bench exposes its frame as a labelled list, not just coloured squares, and the field chart ships the same series as a 13-row data table.",
  "c7.a11y.5":
    "The page is fully usable with scripting absent: content is visible by default rather than staged behind an animation.",
  "c7.a11y.6":
    "The guided demo is opt-in and keyboard operable: arrows move between the seven steps, Escape closes it, and the section it is talking about is marked rather than merely scrolled to.",

  "c7.perf.1": "Zero runtime dependencies. No third-party script is fetched, so there is no supply chain to audit.",
  "c7.perf.2": "Two Web Workers take bulk encoding and scenario runs off the main thread; the frame time readout in the header proves it.",
  "c7.perf.3": "Fonts are self-hosted and Latin-subset. 1% mode downloads no font bytes at all.",
  "c7.perf.4": "The whole shell is precached, so a reload with the network disabled is served from the device.",
  "c7.perf.5":
    "The AEAD is hand-written too — ChaCha20-Poly1305 per RFC 8439 — and checked against the standard's published vectors on every test run. Confidentiality costs 25 bytes, and it is printed as a receipt rather than hidden in a library call.",

  "foot.deliver": "Submission",
  "foot.source": "Source",
  "foot.read": "Read",
  "foot.run": "Run it locally",
  "foot.sources": "Sources & credits",
  "foot.license": "Licence",
  "foot.built": "Built for the 1% Battery brief, Engineering & Social Impact track.",
  "foot.disclaim":
    "Nothing on this site claims that a route is safe or fully accessible, and nothing here replaces professional judgement.",

  "sc.quake.label": "Earthquake · shelter cluster",
  "sc.quake.blurb":
    "Four responders, four villages, mains down, towers on backup power. Traffic spikes after every aftershock.",
  "sc.blackout.label": "City blackout · stairwell search",
  "sc.blackout.blurb":
    "One device walks thirty floors. Nothing reaches the street from inside, so messages hop phone to phone over BLE.",
  "sc.remote.label": "Remote clinic · no towers",
  "sc.remote.blurb":
    "Two hours from the nearest mast, running on a car battery and a LoRa relay up on the ridge.",
  "sc.last1.label": "The last 1%",
  "sc.last1.blurb":
    "Everything else is gone: one bar, one phone, and one person who has to tell four families something true.",

  "im.quake.title": "The first 72 hours",
  "im.quake.body":
    "Aftershocks keep breaking the link. Check-ins queue on the device and leave together the moment a bar appears.",
  "im.quake.when": "day 1 · link available about a third of the time",

  "im.blackout.title": "Thirty floors, no bars",
  "im.blackout.body":
    "Inside a concrete stairwell there is nothing to send with, so a message hops between neighbouring phones until one of them reaches the street.",
  "im.blackout.when": "first hour · 60 m hops",

  "im.remote.title": "A clinic with no towers",
  "im.remote.body":
    "Two hours from the nearest mast, one ridge relay, and a supply list that has to arrive before the generator does.",
  "im.remote.when": "routine · a few messages an hour, for weeks",

  "im.ferry.title": "Coastal ferry, out of range",
  "im.ferry.body":
    "Between two islands there is no coverage at all. wick holds the queue and sends the whole day at once when the boat lands.",
  "im.ferry.when": "crossing · one transmission per port",

  "im.old.title": "A phone from 2014",
  "im.old.body":
    "The device that survives a disaster is usually the old one in a drawer. Nine-byte frames are cheap enough for it to run for days.",
  "im.old.when": "always · no app store, no account",

  "im.wildfire.title": "Evacuation, grid down",
  "im.wildfire.body":
    "Roads close faster than they can be mapped. A one-byte status token still gets through when a map cannot be sent at all.",
  "im.wildfire.when": "peak load · short, frequent, unambiguous",

  /* 02b — the sealed frame. The receipt for confidentiality, printed in bytes. */
  "c2.seal.title": "Private costs 25 bytes",
  "c2.seal.lead":
    "The frame above is compact, checksummed, and readable by anyone holding the radio. That is fine for a beacon and not fine for a location. So there is a second layer, and it is priced the same way as everything else on this page.",
  "c2.seal.run": "Seal this frame",
  "c2.seal.again": "Seal the next one",
  "c2.seal.tamper": "Flip one bit in the tag",
  "c2.seal.alg": "ChaCha20-Poly1305",
  "c2.seal.wire": "On the wire",
  "c2.seal.roundtrip.ok": "opened again, byte for byte identical",
  "c2.seal.roundtrip.bad": "rejected — the tag did not match",
  "c2.seal.hint":
    "ChaCha20-Poly1305, RFC 8439, implemented in src/core/cipher.js and checked against the published test vectors in §2.3.2, §2.4.2, §2.5.2 and §2.8.2. The 9-byte header travels as associated data: a relay can read the algorithm and the counter, and cannot change either without breaking the tag. The key is exchanged offline and never leaves the device.",
  "c2.seal.counter": "message counter",
  "c2.seal.note":
    "A 6-byte check-in becomes 31 bytes sealed. Against the 354-byte chat envelope in section 01 that is still 11× smaller — privacy here is a 25-byte line item, not a rewrite.",
  "c2.seal.replay": "Replay the same sealed frame",
  "c2.seal.replay.bad": "rejected — counter already used",

  "c1.seal.plain": "plaintext frame",
  "c1.seal.alg": "algorithm id",
  "c1.seal.nonce": "nonce tail",
  "c1.seal.tag": "Poly1305 tag",
  "c1.seal.total": "sealed frame",

  /* the guided demo — DEMO.md, made walkable */
  "demo.title": "Guided demo",
  "tour.title": "Guided demo · seven steps",
  "tour.prev": "← Back",
  "tour.next": "Next →",
  "tour.done": "Finish",
  "tour.exit": "Exit",
  "tour.s1":
    "Start here without touching anything. The rail on the left is this page's own battery: it drains from 100% to 1% as you read. The product and the page are the same argument.",
  "tour.s2":
    "Section 01. Drag the outbox slider to 8. Framing is paid per transmission, not per message, so batching removes the fixed cost: 354 → 266 bytes for the baseline and 67 → 13.6 for wick — 19.6×.",
  "tour.s3":
    "Section 02, the core of the demo. Type your own message and watch the frame rebuild byte by byte. Then press \"seal this frame\": confidentiality costs 25 bytes, and \"flip one bit\" shows a forged tag being rejected.",
  "tour.s4":
    "Section 03. Leave the level at 1% and switch the radio from LTE to LoRa. The ranking is by messages delivered, not throughput — in a 1% world, fast and expensive is worth nothing.",
  "tour.s5":
    "Section 04, the second most important one. Set the link to \"No link\", queue three messages, then switch to Edge and watch the whole queue leave in one transmission.",
  "tour.s6":
    "Section 05. Run the earthquake scenario, then export the result as a card. The card is drawn locally and carries the word \"modelled\" on it, because the scenario engine is a model and not a field trial.",
  "tour.s7":
    "Section 07, and the end of the demo. The payload table is measured from the real files by a script. The footer states the boundary the project does not cross: no route is claimed to be safe, and nothing here replaces professional judgement.",

  "a11y.table": "Read the numbers as a table",
  "c5.table.elapsed": "elapsed",
  "c5.share": "Export this result as a card",
  "c5.share.done": "PNG written",
  "c5.share.hint":
    "The card is drawn in a canvas on this device — no server, no upload, no image library, and it works with the network unplugged.",

  "card.delivered": "MESSAGES DELIVERED",
  "card.hours": "HOURS STILL TALKING",
  "card.modelled": "Modelled over {hours} h with seed {seed} — a seeded simulation, not a field trial.",
};
