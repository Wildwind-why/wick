/**
 * capture-06.js — Playwright-driven capture for the offline section.
 *
 * Headless Chrome's --screenshot mode waits for network-idle, which never
 * happens while a Service Worker is installing its shell. Playwright lets us
 * wait for the exact DOM state we want (active · shell cached · 43/43) and then
 * shoot, so the screenshot is an honest render of the real page.
 */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox", "--disable-gpu"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();
  await page.goto("http://127.0.0.1:8123/tools/shots.html?section=offline&lang=en", {
    waitUntil: "networkidle",
    timeout: 120000,
  });

  // The real page lives in the iframe.
  const iframe = page.frame({ url: /index\.html/ });
  if (!iframe) {
    console.error("iframe not found");
    process.exit(1);
  }

  // Wait until the worker has installed, activated and reported its cache.
  const sw = await iframe.waitForSelector("#off-sw[data-verdict='active'][data-shell]", {
    timeout: 120000,
  });
  const text = await sw.textContent();
  const shell = await sw.getAttribute("data-shell");
  console.log(`SW readout: ${text.trim()} · ${shell}`);

  // The harness sizes the iframe and writes the final height into its own title.
  // Fall back to a generous fixed crop if the title probe is not available.
  const title = await page.title().catch(() => "");
  const match = title.match(/H=(\d+)/);
  const height = match ? parseInt(match[1], 10) : 1400;

  await page.screenshot({
    path: "/Users/ddseven/WorkBuddy/2026-10-11-21-07-50/work/wick-1.0/screenshots/06-offline-outbox.png",
    clip: { x: 0, y: 0, width: 1440, height },
    type: "png",
  });

  await browser.close();
  console.log("06-offline-outbox.png captured");
})();
