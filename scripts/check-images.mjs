import { chromium } from '@playwright/test';
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('response', async r=>{if(r.url().includes('/media/')) console.log(r.status(),r.headers()['content-type'],r.url());});
await page.goto('http://127.0.0.1:5177/shop');await page.getByRole('heading',{name:'The collection',exact:true}).waitFor();
await page.locator('main img').first().evaluate(async im=>{try{await im.decode()}catch(e){console.log(e.message)}});
console.log(await page.locator('main img').evaluateAll(imgs=>imgs.slice(0,4).map(i=>({src:i.currentSrc,complete:i.complete,width:i.naturalWidth}))));
await page.screenshot({path:'test-artifacts/images-check.png'});await browser.close();
