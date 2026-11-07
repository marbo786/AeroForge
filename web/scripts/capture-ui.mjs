import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const pass=process.argv[2]??'review';
if(!/^[a-z0-9-]+$/.test(pass))throw new Error('Use a plain QA pass name.');
const server=spawn(process.execPath,['scripts/serve-static.mjs'],{env:{...process.env,PORT:'4175'},stdio:'pipe',windowsHide:true});
try {
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`Server exited: ${code}`)));});
  const browser=await chromium.launch(process.platform==='win32'?{channel:'chrome'}:{});
  try {
    await mkdir(`../docs/ui-redesign/${pass}`,{recursive:true});
    for(const [name,width,height] of [['desktop',1440,900],['tablet',1024,768],['mobile',390,844]]) {
      const page=await browser.newPage({viewport:{width,height},...(name==='mobile'?{isMobile:true,hasTouch:true}:{})});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.goto('http://127.0.0.1:4175/');
      await page.locator('[role=status]').filter({hasText:'Prediction ready'}).waitFor({state:'attached'});
      await page.locator('.spark-line').first().waitFor({state:'attached'});
      await page.screenshot({path:`../docs/ui-redesign/${pass}/${name}.png`,fullPage:true,animations:'disabled'});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      if(name==='mobile') {
        await page.getByRole('button',{name:'Edit parameters',exact:true}).click();
        await page.getByRole('button',{name:'full',exact:true}).click();
        await page.screenshot({path:`../docs/ui-redesign/${pass}/mobile-sheet.png`,fullPage:false,animations:'disabled'});
      }
      await page.getByRole('button',{name:'Details / evidence',exact:true}).click();
      await page.waitForFunction(()=>[...document.querySelectorAll('dialog[open] .drawer-body,dialog[open] .module')].every(node=>Number(getComputedStyle(node).opacity)>.999));
      await page.screenshot({path:`../docs/ui-redesign/${pass}/${name}-details.png`,fullPage:false});
      await page.getByRole('button',{name:'Close Details',exact:true}).click();
      if(name==='mobile')await page.getByRole('button',{name:'peek',exact:true}).click();
      await page.getByRole('button',{name:'Charts +',exact:true}).click();
      await page.locator('.chart-line').first().waitFor({state:'attached'});
      await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('dialog[open] .drawer-body')).opacity)>.999);
      await page.getByRole('button',{name:'Close Charts',exact:true}).scrollIntoViewIfNeeded();
      await page.screenshot({path:`../docs/ui-redesign/${pass}/${name}-charts.png`,fullPage:false,animations:'disabled'});
      await page.goto('http://127.0.0.1:4175/model/');
      await page.waitForFunction(()=>[...document.querySelectorAll('.module')].every(node=>Number(getComputedStyle(node).opacity)>.999));
      await page.screenshot({path:`../docs/ui-redesign/${pass}/${name}-evidence.png`,fullPage:true,animations:'disabled'});
      await writeFile(`../docs/ui-redesign/${pass}/${name}.json`,JSON.stringify({viewport:{width,height},overflow,errors,browser:browser.version()},null,2));
      console.log(`${name}: overflow=${overflow}; errors=${JSON.stringify(errors)}`);
      await page.close();
    }
  } finally {await browser.close();}
} finally {server.kill();}
