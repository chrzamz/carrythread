// Standalone site QA: node site/check.mjs [--screenshots /absolute/output/directory]
// Uses a separate headless browser and ephemeral localhost port; never touches user tabs.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { messages } from './messages.js';
import { release } from './release.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const screenshotArg=process.argv.indexOf('--screenshots');
const screenshotDir=screenshotArg>=0?process.argv[screenshotArg+1]:null;
if(screenshotArg>=0&&!screenshotDir) throw new Error('Supply a screenshot output directory.');
function leafPaths(value,prefix='') {
  if(value&&typeof value==='object') return Object.entries(value).flatMap(([key,item])=>leafPaths(item,`${prefix}.${key}`));
  assert.equal(typeof value,'string',prefix);
  assert.ok(value.trim().length,prefix);
  return [prefix];
}
const baseline=leafPaths(messages.en).sort();
for(const [locale,value] of Object.entries(messages)) assert.deepEqual(leafPaths(value).sort(),baseline,`Translation key parity: ${locale}`);
for(const asset of ['logo.svg','mark.svg','wordmark.svg']) assert.equal(await fs.readFile(path.join(root,'assets',asset),'utf8'),await fs.readFile(path.join(root,'../resources/brand',asset),'utf8'),`Brand asset parity: ${asset}`);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try {
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname.startsWith('/carrythread/')) pathname=pathname.slice('/carrythread'.length);
    const target=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
    if(!target.startsWith(`${root}${path.sep}`)){res.writeHead(403);res.end();return;}
    const bytes=await fs.readFile(target);res.writeHead(200,{'content-type':types[path.extname(target)]||'application/octet-stream'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const findings=[];
try {
  const context=await browser.newContext({viewport:{width:1440,height:1100},permissions:['clipboard-read','clipboard-write'],reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  if(screenshotDir) await fs.mkdir(screenshotDir,{recursive:true});
  for(const locale of Object.keys(messages)) {
    await page.goto(`${origin}/?lang=${locale}`);
    await page.waitForSelector('#demo-panel');
    assert.equal(await page.locator('html').getAttribute('lang'),locale);
    assert.equal(await page.locator('h1').count(),1);
    assert.equal(await page.locator('.support-table tbody tr').count(),6);
    assert.equal(await page.locator('.release-link').first().getAttribute('href'),release.stage==='released'?release.latest:release.releases);
    await page.locator('[data-project="2"]').click();
    await page.locator('[data-tab="2"]').click();
    await page.selectOption('#handoff-target','Pi');
    assert.ok((await page.locator('#handoff-preview').inputValue()).includes('Carrythread → Pi'));
    await page.locator('#copy-context').click();
    await page.waitForFunction(text=>document.querySelector('#copy-status')?.textContent===text,messages[locale].demo.copied);
    assert.equal(await page.locator('#copy-status').textContent(),messages[locale].demo.copied);
    assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).includes(messages[locale].demo.projects[2].item));
    await page.locator('[data-tab="2"]').focus();
    await page.keyboard.press('Home');
    assert.equal(await page.locator('[data-tab="0"]').getAttribute('aria-selected'),'true');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-tab="1"]').getAttribute('aria-selected'),'true');
    await page.selectOption('#language',locale==='en'?'zh-CN':'en');
    assert.equal(await page.locator('[data-project="2"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-tab="1"]').getAttribute('aria-selected'),'true');
    await page.selectOption('#language',locale);
    await page.locator('[data-project="0"]').click();
    await page.locator('[data-tab="0"]').click();
    for(const width of [1440,1100,390,360]) {
      await page.setViewportSize({width,height:width<700?844:1100});
      const sizes=await page.evaluate(()=>({body:document.body.scrollWidth,html:document.documentElement.scrollWidth,width:innerWidth}));
      assert.ok(sizes.body<=width+1&&sizes.html<=width+1,`${locale}: horizontal overflow at ${width}: ${JSON.stringify(sizes)}`);
      if(screenshotDir&&(width===1440||width===390)) await page.screenshot({path:path.join(screenshotDir,`${locale}-${width}.png`),fullPage:true});
    }
    findings.push({locale,translationLeaves:baseline.length,viewports:[1440,1100,390,360],projectSwitch:true,tabKeyboard:true,copy:true,languagePreservesSelection:true});
    await page.setViewportSize({width:1440,height:1100});
  }
  await page.goto(`${origin}/carrythread/?lang=en`);
  await page.waitForSelector('#demo-panel');
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.deepEqual(errors,[],'Browser runtime errors');
  // Local hosting under a project subdirectory must keep relative asset paths.
  const linked=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));
  for(const href of linked) assert.ok(href.startsWith('#')||href.startsWith(release.repository),'Unexpected external link: '+href);
  console.log(JSON.stringify({ok:true,releaseStage:release.stage,locales:findings,brandAssetParity:true,githubPagesSubpath:true,browserErrors:errors,screenshotDir},null,2));
  await context.close();
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
