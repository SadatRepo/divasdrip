import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const base=process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5177';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Local-only test');
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);
const token=readFileSync('.dev.vars','utf8').match(/^ADMIN_TOKEN\s*=\s*["']?([^\r\n"']+)/m)?.[1];
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let id;
try {
 await page.goto(base+'/admin/products');await page.getByRole('button',{name:'Local token',exact:true}).click();await page.getByLabel('Admin token',{exact:true}).fill(token);await page.getByRole('button',{name:'Open workspace',exact:true}).click();
 await page.getByRole('heading',{name:'New product draft',exact:true}).waitFor();
 const title='QA Product '+Date.now();
 await page.getByPlaceholder('Product title',{exact:true}).fill(title);
 await page.getByRole('combobox',{name:'Product category',exact:true}).selectOption('cat-full-length');
 await page.getByPlaceholder('Short description',{exact:true}).fill('Temporary local browser verification product.');
 await page.getByPlaceholder('SKU',{exact:true}).fill('QA-'+Date.now());
 await page.getByPlaceholder('Size',{exact:true}).fill('M');await page.getByPlaceholder('Colour',{exact:true}).fill('Blue');
 await page.getByPlaceholder('Price',{exact:true}).fill('2450.50');await page.getByPlaceholder('Stock',{exact:true}).fill('2');
 await page.locator('input[type=file]').setInputFiles('public/images/catalog/blue-bloom-maxi-1.webp');
 await page.getByPlaceholder('Image alt text',{exact:true}).fill('Blue floral maxi dress');
 const created=page.waitForResponse(r=>r.url().endsWith('/api/admin/products')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Save draft',exact:true}).click();const response=await created;
 if(response.status()!==201) throw new Error('Create failed: '+await response.text());id=(await response.json()).id;
 await page.getByRole('heading',{name:title,exact:true}).waitFor();
 await page.getByRole('combobox',{name:'Publication state',exact:true}).selectOption('published');
 await page.getByPlaceholder('Tags, separated by commas',{exact:true}).fill('qa, browser-check');
 const saved = page.waitForResponse(r=>r.url().endsWith('/api/admin/products/'+id)&&r.request().method()==='PATCH');
 await page.getByRole('button',{name:'Save product details',exact:true}).click();const saveResponse=await saved;console.log('Saved publication:',(await saveResponse.json()).publication_state);await page.getByText('Product details saved.',{exact:true}).waitFor();
 const publicLink=page.getByRole('link',{name:'View live product',exact:true});const href=await publicLink.getAttribute('href');
 await publicLink.click();await page.getByRole('heading',{name:title,exact:true}).waitFor();await page.locator('main img').first().evaluate(async image=>await image.decode());
 console.log('Browser product creation, upload, edit and publication passed:',href);
 await page.goto(base+'/admin/products');await page.getByRole('heading',{name:'Products',exact:true}).waitFor();
 for(const width of [375,768,1024,1440]) {await page.setViewportSize({width,height:900});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) errors.push('Admin products overflow '+width);}
 console.log('Admin browser errors:',errors);
} finally {
 if(id){const r=await fetch(base+'/api/admin/products/'+id,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({publicationState:'archived'})});console.log('Archived local QA product:',r.status);}
 await browser.close();
}
if(errors.length) process.exitCode=1;
