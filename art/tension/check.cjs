// Browser verification for the local study. Requires Playwright + Chromium.
// NODE_PATH=/path/to/node_modules node art/tension/check.cjs
// No network access is needed by the artwork or these checks.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const receipts={date:new Date().toISOString(),browser:browser.version(),checks:[],snapshots:{}};
const errors=[],requests=[];
const page=await browser.newPage({viewport:{width:1100,height:1000}});
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
const url=pathToFileURL(path.join(__dirname,'index.html')).href;
const step=n=>page.evaluate(n=>window.__studio.step(n),n);
const snapshot=()=>page.evaluate(()=>window.__studio.snapshot());
const position=async(x,y)=>{const b=await page.locator('canvas').boundingBox();return [b.x+x*b.width/960,b.y+y*b.height/720];};
const down=async(x,y)=>{await page.mouse.move(...await position(x,y));await page.mouse.down();};
const move=async(x,y)=>page.mouse.move(...await position(x,y));
const check=(name,condition)=>{assert.ok(condition,name);receipts.checks.push(name);};
await page.goto(url+'?capture');
await step(3600);
check('one minute at rest does not rupture', (await snapshot()).broken===0);
check('resting mesh remains finite', (await snapshot()).finite);
await page.locator('#reset').click();await step(120);
await down(480,355);await move(490,365);await step(90);await page.mouse.up();await step(300);
receipts.snapshots.smallPull=await snapshot();
check('small pull and release preserve all connections',receipts.snapshots.smallPull.broken===0);
check('pointer release drops all held nodes',receipts.snapshots.smallPull.held===0);
await page.locator('#reset').click();await step(120);
receipts.snapshots.before=await snapshot();
await page.locator('canvas').screenshot({path:path.join(__dirname,'01-before.png')});
await down(480,355);await move(750,620);await step(40);
receipts.snapshots.pulling=await snapshot();
check('large pull ruptures some connections',receipts.snapshots.pulling.broken>0);
await page.locator('canvas').screenshot({path:path.join(__dirname,'02-pulling.png')});
await step(100);await page.mouse.up();await step(300);
receipts.snapshots.after=await snapshot();
check('release preserves ruptures',receipts.snapshots.after.broken>=receipts.snapshots.pulling.broken);
check('deformation remains visible after release',receipts.snapshots.after.maxDisplacement>100);
await page.locator('canvas').screenshot({path:path.join(__dirname,'03-after.png')});
await page.setViewportSize({width:390,height:844});
check('resize preserves broken connections',(await snapshot()).broken===receipts.snapshots.after.broken);
check('small screen has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.locator('#reset').click();
check('reset restores all connections',(await snapshot()).broken===0);
await step(120);await page.locator('canvas').focus();await page.keyboard.press('Space');
check('keyboard can grip',(await snapshot()).held>0);
for(let i=0;i<8;i++){await page.keyboard.press('ArrowDown');await step(2);}
await page.keyboard.press('Escape');
check('Escape releases keyboard grip',(await snapshot()).held===0);
await page.keyboard.press('Space');await page.keyboard.press('Tab');
check('leaving canvas releases keyboard grip',(await snapshot()).held===0);
// Stress repeated pulls at several points; coordinates must remain finite.
for(let i=0;i<12;i++){await down(200+i*45,400);await move(i%2?870:60,i%3?630:70);await step(100);await page.mouse.up();await step(60);}
check('repeated stress leaves finite coordinates',(await snapshot()).finite);
const touch=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
touch.on('pageerror',e=>errors.push(String(e)));
await touch.goto(url+'?capture');await touch.evaluate(()=>window.__studio.step(120));
const b=await touch.locator('canvas').boundingBox();
const cdp=await touch.context().newCDPSession(touch);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width*0.5,y:b.y+b.height*355/720}]});
check('touch can grip',await touch.evaluate(()=>window.__studio.snapshot().held>0));
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width*0.75,y:b.y+b.height*0.8}]});
await touch.evaluate(()=>window.__studio.step(100));
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
check('touch release clears grip',await touch.evaluate(()=>window.__studio.snapshot().held===0));
check('reduced-motion interaction remains finite',await touch.evaluate(()=>window.__studio.snapshot().finite));
await touch.screenshot({path:path.join(__dirname,'mobile-check.png')});
// Exercise ordinary requestAnimationFrame path too, without capture controls.
await page.goto(url);await down(480,355);await move(490,365);
await page.waitForTimeout(250);await page.mouse.up();
check('normal route does not expose capture controls',await page.evaluate(()=>!window.__studio));
check('no browser page errors',errors.length===0);
check('artwork makes no HTTP requests',requests.length===0);
receipts.sequence={settlingSteps:120,pullFrom:[480,355],pullTo:[750,620],heldCaptureAfterSteps:40,additionalHeldSteps:100,afterReleaseSteps:300,simulationHz:60};
fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(receipts,null,2)+'\n');
console.log(JSON.stringify(receipts,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
