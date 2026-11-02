import assert from 'node:assert/strict';
import { copyFile, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { messages } from '../site/messages.js';
import { release } from '../site/release.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'site');
const output=path.join(source,'dist');
const files=['index.html','styles.css','app.js','messages.js','release.js','assets/mark.svg','assets/logo.svg','assets/wordmark.svg'];
const repo='https://github.com/chrzamz/carrythread';
assert.equal(release.repository,repo,'Unexpected repository link');
assert.equal(release.releases,`${repo}/releases`,'Unexpected releases link');
assert.equal(release.latest,`${repo}/releases/latest`,'Unexpected latest release link');
assert.ok(['pre-release','released'].includes(release.stage),'Invalid release stage');
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
assert.equal(release.version,pkg.version,'Site and package versions differ');
function leaves(value,prefix='') {
  if(value&&typeof value==='object') return Object.entries(value).flatMap(([key,v])=>leaves(v,`${prefix}.${key}`));
  assert.equal(typeof value,'string',prefix);assert.ok(value.trim(),prefix);return [prefix];
}
const baseKeys=leaves(messages.en).sort();
for(const locale of ['en','zh-CN','es','ja']) assert.deepEqual(leaves(messages[locale]).sort(),baseKeys,`Language key parity: ${locale}`);
for(const filename of files) assert.ok((await lstat(path.join(source,filename))).isFile(),`Not a regular file: ${filename}`);
for(const asset of ['mark.svg','logo.svg','wordmark.svg']) assert.equal(await readFile(path.join(source,'assets',asset),'utf8'),await readFile(path.join(root,'resources','brand',asset),'utf8'),`Brand copy differs: ${asset}`);
const html=await readFile(path.join(source,'index.html'),'utf8');
for(const [,href] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if(href.startsWith('#')) continue;
  if(href.startsWith('https:')) {assert.ok(href.startsWith(repo),'Unexpected external HTML link');continue;}
  assert.ok(href.startsWith('./'),'Assets must support the /carrythread/ subpath');
  assert.ok(files.includes(href.slice(2)),`Unlisted asset: ${href}`);
}
const app=await readFile(path.join(source,'app.js'),'utf8');
for(const [,relative] of app.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)) assert.ok(files.includes(relative),`Missing script import: ${relative}`);
for(const filename of ['app.js','messages.js','release.js','index.html','styles.css']) {
  const text=await readFile(path.join(source,filename),'utf8');
  assert.ok(!/(?:\/Users\/|C:\\Users\\|BEGIN (?:RSA )?PRIVATE KEY|sk-proj-[A-Za-z0-9]{16})/.test(text),`Private data pattern in ${filename}`);
}
await rm(output,{recursive:true,force:true});
for(const filename of files) {await mkdir(path.dirname(path.join(output,filename)),{recursive:true});await copyFile(path.join(source,filename),path.join(output,filename));}
await writeFile(path.join(output,'.nojekyll'),'');
console.log(JSON.stringify({output:'site/dist',files:[...files,'.nojekyll'],releaseStage:release.stage,version:release.version,locales:Object.keys(messages),translationLeaves:baseKeys.length},null,2));
