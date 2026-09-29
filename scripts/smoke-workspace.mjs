import {chromium} from '@playwright/test';import {readFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);const base=process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5177'; if(!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Local-only check');
const token=readFileSync('.dev.vars','utf8').match(/^ADMIN_TOKEN\s*=\s*["']?([^\r\n"']+)/m)?.[1];const failures=[];
page.on('pageerror',e=>failures.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/api/'))failures.push(r.status()+' '+new URL(r.url()).pathname)});
try{await page.goto(base+'/admin');await page.getByRole('button',{name:'Local token',exact:true}).click();await page.getByLabel('Admin token',{exact:true}).fill(token);await page.getByRole('button',{name:'Open workspace',exact:true}).click();await page.getByRole('navigation').first().waitFor();
for(const route of ['','categories','orders','reports','inquiries','audit','diagnostics','staff','delivery','inventory','collections','media','content','promotions','settings']){
 await page.goto(base+'/admin'+(route?'/'+route:''));await page.getByRole('heading',{level:1}).waitFor();await page.waitForLoadState('networkidle');console.log(route||'dashboard',await page.getByRole('heading',{level:1}).innerText());
}
console.log('Failures:',failures);if(failures.length)process.exitCode=1;
}finally{await browser.close()}
