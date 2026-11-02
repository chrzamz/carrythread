// Original SVG -> deterministic PNG frames -> ICO / ICNS. No downloaded artwork.
// Requires the repository's Playwright Chromium: pnpm exec playwright install chromium
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'resources');
const source=await readFile(path.join(output,'brand','mark.svg'),'utf8');
assert.ok(source.includes('viewBox="0 0 64 64"'),'Unexpected brand source');
assert.ok(!/<(?:script|image|foreignObject)\b|(?:href|src)=|@import|url\(/i.test(source),'Icon source must be a self-contained vector');
const sizes=[16,24,32,48,64,128,256,512,1024];
const frames=new Map();
const browser=await chromium.launch({headless:true,args:['--force-color-profile=srgb','--disable-gpu']});
try {
  const context=await browser.newContext({deviceScaleFactor:1,colorScheme:'light',reducedMotion:'reduce'});
  const page=await context.newPage();
  for(const size of sizes) {
    await page.setViewportSize({width:size,height:size});
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${source}`);
    const bytes=await page.screenshot({type:'png',omitBackground:true,animations:'disabled',scale:'css'});
    assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
    frames.set(size,bytes);
  }
  await context.close();
} finally {await browser.close();}
// Vista-and-later ICO entries may contain complete PNG images.
const icoSizes=sizes.filter(size=>size<=256);
const icoHeader=Buffer.alloc(6+16*icoSizes.length);icoHeader.writeUInt16LE(1,2);icoHeader.writeUInt16LE(icoSizes.length,4);
let offset=icoHeader.length;
for(const [i,size] of icoSizes.entries()) {
  const p=6+i*16, bytes=frames.get(size);
  icoHeader[p]=icoHeader[p+1]=size===256?0:size;
  icoHeader.writeUInt16LE(1,p+4);icoHeader.writeUInt16LE(32,p+6);icoHeader.writeUInt32LE(bytes.length,p+8);icoHeader.writeUInt32LE(offset,p+12);offset+=bytes.length;
}
const ico=Buffer.concat([icoHeader,...icoSizes.map(size=>frames.get(size))]);
// Modern ICNS PNG representations, including standard and Retina slots.
const icnsTypes=[['icp4',16],['icp5',32],['icp6',64],['ic07',128],['ic08',256],['ic09',512],['ic10',1024],['ic11',32],['ic12',64],['ic13',256],['ic14',512]];
const chunks=icnsTypes.map(([type,size])=>{const data=frames.get(size),head=Buffer.alloc(8);head.write(type,0,4,'ascii');head.writeUInt32BE(data.length+8,4);return Buffer.concat([head,data]);});
const icnsHeader=Buffer.alloc(8);icnsHeader.write('icns',0,4,'ascii');icnsHeader.writeUInt32BE(8+chunks.reduce((sum,chunk)=>sum+chunk.length,0),4);
const icons={'icon.png':frames.get(1024),'icon.ico':ico,'icon.icns':Buffer.concat([icnsHeader,...chunks])};
await mkdir(output,{recursive:true});
for(const [name,bytes] of Object.entries(icons)) await writeFile(path.join(output,name),bytes);
console.log(JSON.stringify({source:'resources/brand/mark.svg',renderer:'Playwright Chromium',icons:Object.entries(icons).map(([name,bytes])=>({path:`resources/${name}`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}))},null,2));
