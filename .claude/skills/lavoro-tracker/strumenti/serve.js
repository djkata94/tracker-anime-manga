// Server statico per provare il sito in locale (skill lavoro-tracker).
// Uso: node serve.js <cartella-del-sito> [porta]   (porta predefinita 8765)
// Cache-Control no-store: ogni ricarica prende i file appena modificati.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2]), port = +process.argv[3] || 8765;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { console.log('404', req.url); res.writeHead(404); return res.end('404'); }
  console.log('200', req.url);
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log('listening on', port));
