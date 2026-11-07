import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const server=spawn(process.execPath,['scripts/serve-static.mjs'],{env:{...process.env,PORT:'4176'},stdio:'pipe',windowsHide:true});
try {
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
  const browser=await chromium.launch(process.platform==='win32'?{channel:'chrome'}:{});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    await page.goto('http://127.0.0.1:4176/');
    await page.getByRole('status').filter({hasText:'Prediction ready'}).waitFor({state:'attached'});
    await page.locator('.spark-line').first().waitFor();
    const box=await page.locator('.geometry-handle.camber .handle-dot').boundingBox();
    if(!box)throw new Error('Camber handle unavailable.');
    const x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y);await page.mouse.down();
    const sampling=page.evaluate(()=>new Promise(resolve=>{
      const intervals=[];let last=performance.now();
      function sample(now){intervals.push(now-last);last=now;if(intervals.length<180)requestAnimationFrame(sample);else resolve(intervals.slice(1));}
      requestAnimationFrame(sample);
    }));
    for(let i=0;i<120;i++){
      await page.mouse.move(x,y-14*Math.sin(i/16));
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    const intervals=await sampling;
    const sorted=[...intervals].sort((a,b)=>a-b);
    const report={viewport:{width:1440,height:900},browser:browser.version(),samples:intervals.length,
      medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],
      meanMs:intervals.reduce((a,b)=>a+b,0)/intervals.length,framesOver25Ms:intervals.filter(v=>v>25).length,
      scope:'Local Windows Chrome requestAnimationFrame intervals during real pointer dragging; includes automation overhead. Not a physical phone or universal hardware benchmark.'};
    await writeFile('../docs/ui-redesign/frame-profile.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
  } finally {await browser.close();}
} finally {server.kill();}
