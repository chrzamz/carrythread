import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
export async function createSiteServer({port=4174,directory=path.join(project,'site','dist')}={}) {
  if(!Number.isInteger(port)||port<0||port>65535) throw new Error('Port must be an integer from 0 to 65535.');
  let root;
  try {root=await realpath(directory);await stat(path.join(root,'index.html'));}
  catch {throw new Error('Built site not found. Run pnpm site:build first.');}
  const server=http.createServer(async(req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    try {
      let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname==='/'||pathname==='/carrythread'){res.writeHead(302,{Location:'/carrythread/'});res.end();return;}
      if(pathname.startsWith('/carrythread/')) pathname=pathname.slice('/carrythread'.length);
      if(pathname.endsWith('/')) pathname+='index.html';
      const candidate=path.resolve(root,`.${pathname}`);
      const relative=path.relative(root,candidate);
      if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403);res.end();return;}
      const resolved=await realpath(candidate);
      if(!resolved.startsWith(root+path.sep)||!(await stat(resolved)).isFile()||!types[path.extname(resolved)]){res.writeHead(404);res.end();return;}
      const bytes=await readFile(resolved);
      res.writeHead(200,{'content-type':types[path.extname(resolved)],'content-length':bytes.length,'cache-control':'no-store','x-content-type-options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:bytes);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const i=process.argv.indexOf('--port');
  const port=i<0?4174:Number(process.argv[i+1]);
  const server=await createSiteServer({port});
  console.log(`Carrythread site: http://127.0.0.1:${server.address().port}/carrythread/`);
  for(const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>server.close(()=>process.exit(0)));
}
