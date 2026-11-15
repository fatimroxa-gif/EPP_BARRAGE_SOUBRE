// Serveur Railway : fichiers statiques + API (netlify/functions/api.mjs).
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import api from './netlify/functions/api.mjs';

const root=fileURLToPath(new URL('.',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon','.json':'application/json'};
const hidden=/^(\/\.|\/netlify|\/server\.mjs|\/package\.json|\/supabase-schema\.sql|\/netlify\.toml|\/README)/;

createServer(async (req,res)=>{
  try{
    const url=new URL(req.url,'http://'+(req.headers.host||'localhost'));
    if(url.pathname.startsWith('/api/')){
      const chunks=[];for await(const c of req)chunks.push(c);
      const r=await api(new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}));
      res.writeHead(r.status,Object.fromEntries(r.headers));
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    let p=decodeURIComponent(url.pathname);if(p.endsWith('/'))p+='index.html';
    const f=normalize(join(root,p));
    if(!f.startsWith(root)||hidden.test('/'+f.slice(root.length)))throw 0;
    if(!(await stat(f)).isFile())throw 0;
    res.writeHead(200,{'content-type':types[extname(f).toLowerCase()]||'application/octet-stream'});
    res.end(await readFile(f));
  }catch{res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Introuvable');}
}).listen(process.env.PORT||8080,'0.0.0.0');
