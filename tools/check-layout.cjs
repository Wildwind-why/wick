const {chromium}=require('playwright');
const {createServer}=require('./serve.cjs');
const path=require('node:path');
(async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto('http://127.0.0.1:'+server.address().port+'/?lang=zh&still=1');await page.waitForFunction(()=>window.__wick?.ok);
    console.log(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,id:e.id,class:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(e=>e.right>innerWidth+1||e.left < -1).slice(0,25)})));
    console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.scrollWidth>e.clientWidth+5&&getComputedStyle(e).overflowX==='visible').map(e=>({tag:e.tagName,id:e.id,cls:e.className,width:e.clientWidth,scroll:e.scrollWidth})).slice(0,40)));
    await page.locator('#offline').screenshot({path:path.resolve(__dirname,'../screenshots/extra/09-mobile-workbench.png')});
    await page.screenshot({path:path.resolve(__dirname,'../screenshots/extra/10-mobile-hero.png')});
  }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
