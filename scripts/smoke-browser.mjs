import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5177';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Smoke checks are local-only');
mkdirSync('test-artifacts', {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
await page.goto(base); await page.getByRole('heading',{name:'A little drama. All you.'}).waitFor();
await page.locator('img').evaluateAll(async images => { await Promise.all(images.map(async image => { image.loading = 'eager'; try { await image.decode(); } catch {} })); });
await page.screenshot({path:'test-artifacts/home-desktop.png',fullPage:true});
console.log('Home loaded, products:', await page.locator('a[href^="/product/"]').count());
await page.goto(base+'/product/blue-bloom-maxi'); await page.getByRole('heading',{name:'Blue Bloom Maxi',exact:true}).waitFor();
console.log('Product actions:', await page.getByRole('button').allTextContents());
await page.getByRole('button',{name:/add to (bag|cart)/i}).click();
await page.getByRole('dialog').waitFor();
console.log('Bag state:', await page.getByRole('dialog').innerText());
await page.getByRole('link',{name:'Continue to checkout'}).click();
await page.getByRole('heading',{name:'Almost yours.',exact:true}).waitFor();
await page.locator('img').evaluateAll(async images => { await Promise.all(images.map(async image => { image.loading = 'eager'; try { await image.decode(); } catch {} })); });
await page.screenshot({path:'test-artifacts/checkout-desktop.png',fullPage:true});
await page.goto(base+'/cart'); await page.getByRole('heading',{name:'Shopping bag',exact:true}).waitFor();
await page.getByRole('button',{name:'Remove',exact:true}).click();
await page.getByRole('main').getByText('Your bag is waiting.',{exact:true}).waitFor();
for(const width of [375,768,1024,1440]){
 await page.setViewportSize({width,height:900}); await page.goto(base+'/shop'); await page.getByRole('heading',{name:'The collection',exact:true}).waitFor();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth); if(overflow) errors.push('Shop overflow '+width);
 if(width===375) {
   await page.locator('img').evaluateAll(async images => { await Promise.all(images.map(async image => { image.loading = 'eager'; await image.decode(); })); });
   await page.screenshot({path:'test-artifacts/shop-mobile.png',fullPage:true});
 }
}
const vars=readFileSync('.dev.vars','utf8'); const token=vars.match(/^ADMIN_TOKEN\s*=\s*["']?([^\r\n"']+)/m)?.[1];
if(!token) throw new Error('Local admin token is missing');
await page.setViewportSize({width:1440,height:1000});
await page.goto(base+'/admin'); await page.getByRole('button',{name:'Local token',exact:true}).click();
await page.getByLabel('Admin token', {exact:true}).fill(token); await page.getByRole('button',{name:'Open workspace',exact:true}).click();
await page.goto(base+'/admin/products'); await page.getByRole('heading',{name:'Products',exact:true}).waitFor();
await page.getByText('Blue Bloom Maxi',{exact:true}).waitFor();
await page.locator('img').evaluateAll(async images => { await Promise.all(images.map(async image => { image.loading = 'eager'; try { await image.decode(); } catch {} })); });
await page.screenshot({path:'test-artifacts/admin-products.png',fullPage:true});
await page.goto(base+'/admin/products/import'); await page.getByRole('heading').first().waitFor();
console.log('Import page:', await page.getByRole('heading').allTextContents());
console.log('Browser errors:',errors); await browser.close(); if(errors.length) process.exitCode=1;
