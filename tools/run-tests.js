/**
 * run-tests.js — run the three browser test suites in headless Chrome via Playwright.
 *
 * codec.test.html  and page.test.html  run in the main frame.
 * offline.test.html needs a real same-origin iframe for Service Worker registration;
 * Playwright gives us a real browser context, so it works headlessly.
 */
const { chromium } = require("playwright-core");

const BASE = process.argv[2] || "http://127.0.0.1:8123";
const TESTS = [
  { name: "codec", url: `${BASE}/tests/codec.test.html`, expect: /(\d+) passed/ },
  { name: "page", url: `${BASE}/tests/page.test.html`, expect: /(\d+) passed/ },
  { name: "offline", url: `${BASE}/tests/offline.test.html`, expect: /(\d+) passed/ },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let allGood = true;

  for (const t of TESTS) {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    try {
      await page.goto(t.url, { waitUntil: "networkidle", timeout: 60000 });
    } catch (e) {
      console.log(`${t.name}: GOTO ERROR — ${e.message}`);
      allGood = false;
      await page.close();
      continue;
    }

    // Wait for the summary line to stabilise on "X passed · Y failed".
    const summary = await page.waitForFunction(
      () => {
        const el = document.getElementById("summary");
        return el && /passed/.test(el.textContent) ? el.textContent : null;
      },
      null,
      { timeout: 120000, polling: 200 },
    );

    const text = await summary.jsonValue();
    const match = text.match(/(\d+)\s*passed\s*[·\s]\s*(\d+)\s*failed/);
    if (!match) {
      console.log(`${t.name}: UNKNOWN FORMAT — ${text.trim()}`);
      allGood = false;
    } else {
      const [, passed, failed] = match;
      const ok = failed === "0" && errors.length === 0;
      console.log(`${t.name}: ${passed} passed · ${failed} failed` + (ok ? "" : ` (page errors: ${errors.length})`));
      if (!ok) allGood = false;
    }
    if (errors.length) errors.forEach((e) => console.log(`  [page error] ${e.slice(0, 200)}`));

    // For offline, also print the worker report pre block.
    if (t.name === "offline") {
      try {
        const report = await page.$eval("#report", (el) => el.textContent).catch(() => null);
        if (report) console.log("  worker report:\n" + report.split("\n").map((l) => "    " + l).join("\n"));
      } catch { /* ignore */ }
    }

    await page.close();
  }

  await browser.close();
  process.exit(allGood ? 0 : 1);
})();
