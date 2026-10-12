const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve('dist');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const target=path.resolve(root,'.'+(rel==='/'?'/index.html':rel));if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(target,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(e?'Not found':b);});}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
