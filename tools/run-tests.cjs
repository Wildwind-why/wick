// Browser checks against a loopback-only server. Playwright is a development tool.
const { chromium } = require('playwright');
const { createServer } = require('./serve.cjs');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const executablePath = process.env.BROWSER_PATH || [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find(p => fs.existsSync(p));
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath });
    for (const name of ['codec','page','offline','regression']) {
      const context = await browser.newContext();
      const page = await context.newPage(); const errors=[];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/tests/' + name + '.test.html');
      await page.waitForFunction(() => /\d+ passed.*\d+ failed/.test(document.querySelector('#summary')?.textContent || ''), null, { timeout: 60000 });
      const summary=await page.locator('#summary').textContent();
      const failures=await page.locator('#out .fail').evaluateAll(rows=>rows.map(e=>e.parentElement.textContent));
      console.log(name + ': ' + summary, errors.length ? JSON.stringify(errors) : '');
      if (!/\b0 failed/.test(summary) || errors.length) throw new Error(JSON.stringify({name,failures,errors}));
      await context.close();
    }
    const context = await browser.newContext({viewport:{width:1440,height:1000}});
    const page=await context.newPage();
    await page.goto(base+'/?lang=zh&mode=eco');
    await page.waitForFunction(()=>window.__wick?.ok && document.querySelector('#off-sw')?.dataset.state==='ok');
    const fonts=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/woff2|fonts\.css/.test(e.name)).map(e=>e.name));
    if(fonts.length)throw new Error('eco font downloads: '+fonts);
    await page.locator('#off-input').fill('SOS 我被困了，12 人，不安全 🚨');
    await page.locator('#off-form button[type=submit]').click();
    await page.reload();
    await page.waitForFunction(()=>window.__wick?.ok);
    if(!(await page.locator('#off-list').textContent()).includes('SOS 我被困了，12 人，不安全 🚨'))throw new Error('queue lost on reload');
    await context.setOffline(true); await page.reload();
    await page.waitForFunction(()=>window.__wick?.ok);
    if(!(await page.locator('#off-list').textContent()).includes('SOS 我被困了'))throw new Error('offline queue lost');
    await context.setOffline(false);
    console.log('browser: zero eco font requests; IndexedDB reload; actual offline reload PASS');
    await context.close();
    const leftContext=await browser.newContext(),rightContext=await browser.newContext();
    const left=await leftContext.newPage(),right=await rightContext.newPage();
    for(const p of [left,right]) {
      p.on('pageerror', e=>console.log('relay page error: '+e.message));
      p.on('response', r=>{if(r.url().includes('/api/') && r.status()>=400)console.log('relay HTTP '+r.status()+' '+r.url())});
      await p.goto(base+'/?lang=zh&still=1#offline');
      await p.waitForFunction(()=>window.__wick?.ok);
      await p.locator('#off-mode').selectOption('relay');
      await p.locator('#off-room').fill('wick-test-room-2026');
      await p.locator('#off-connect').click();
      await p.waitForFunction(()=>document.querySelector('#off-relay-status').textContent.includes('中继已连接'));
    }
    await left.locator('#off-input').fill('网格4：12名儿童被困。没有饮水。🚨');
    await left.locator('#off-priority').selectOption('3');
    await left.locator('#off-form button[type=submit]').click();
    try {
      await right.waitForFunction(()=>document.querySelector('#off-inbox').textContent.includes('12名儿童被困'),null,{timeout:15000});
      await left.waitForFunction(()=>document.querySelector('#off-count').textContent.includes('1 条对端确认'),null,{timeout:15000});
    } catch(error) {
      for(const [name,p] of [['sender',left],['receiver',right]]) console.log(name,await p.evaluate(()=>Object.fromEntries(['off-list','off-inbox','off-count','off-error','off-hint','off-relay-status'].map(id=>[id,document.getElementById(id)?.textContent]))));
      throw error;
    }
    await left.reload();await left.waitForFunction(()=>window.__wick?.ok);
    if(!(await left.locator('#off-count').textContent()).includes('1 条对端确认'))throw new Error('ACK history lost');
    console.log('browser: isolated peers decode/store/ACK Chinese frame; ACK persists PASS');
    const cachedApi=await left.evaluate(async()=>{
      for(const name of await caches.keys())for(const r of await (await caches.open(name)).keys())if(new URL(r.url).pathname.startsWith('/api/'))return true;
      return false;
    });
    if(cachedApi)throw new Error('private relay API response cached by Service Worker');
    await left.locator('#off-mode').selectOption('relay');
    await left.locator('#off-room').fill('wick-solo-no-peer-2026');
    await left.locator('#off-connect').click();
    await left.waitForFunction(()=>document.querySelector('#off-relay-status').textContent.includes('中继已连接'));
    await left.locator('#off-input').fill('没有接收端时，不能假装送达');
    await left.locator('#off-form button[type=submit]').click();
    await left.locator('#off-list [data-status="failed"]').waitFor({timeout:20000});
    if(!(await left.locator('#off-count').textContent()).includes('1 条对端确认'))throw new Error('no-peer message falsely confirmed');
    console.log('browser: no peer leaves message pending; relay API never cached PASS');
    await leftContext.close();await rightContext.close();
    // Fresh real page captures, including a narrow viewport overflow check.
    const screenshots=path.resolve(__dirname,'../screenshots');
    fs.mkdirSync(path.join(screenshots,'extra'),{recursive:true});
    const visual=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
    const v=await visual.newPage(); await v.goto(base+'/?lang=zh&still=1');await v.waitForFunction(()=>window.__wick?.ok);
    await v.screenshot({path:path.join(screenshots,'01-hero.png')});
    await v.locator('#eco-toggle').click();await v.screenshot({path:path.join(screenshots,'02-hero-1percent-mode.png')});await v.locator('#eco-toggle').click();
    for(const text of ['SOS：12 人被困，没有饮水。🚨','我在网格 4，入口不安全。','需要饮水和药品，请确认收到。']) {
      await v.locator('#off-input').fill(text);
      await v.locator('#off-priority').selectOption(text.startsWith('SOS')?'3':'1');
      await v.locator('#off-form button[type=submit]').click();
    }
    await v.evaluate(()=>document.activeElement?.blur());
    for(const [id,file] of [['cost','03-cost-of-a-sentence.png'],['codec','04-codec-bench.png'],['budget','05-budget-engine.png'],['offline','06-offline-outbox.png'],['field','07-field-simulation.png'],['craft','08-craft.png']]) {
      await v.locator('#'+id).screenshot({path:path.join(screenshots,file),animations:'disabled',style:'.topbar, .skip { visibility: hidden !important; }'});
    }
    for(const width of [360,390]) {
      await v.setViewportSize({width,height:844});
      const overflow=await v.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
      if(overflow)throw new Error('mobile horizontal overflow at '+width);
    }
    await v.locator('#offline').screenshot({path:path.join(screenshots,'extra','09-mobile-workbench.png'),animations:'disabled',style:'.topbar, .skip { visibility: hidden !important; }'});
    console.log('browser: screenshots refreshed; 360/390px viewports have no horizontal overflow PASS');
    await visual.close();
  } finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
