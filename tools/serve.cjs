// Zero-dependency local demo server. Loopback by default; --lan opts into LAN access.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
function createServer() {
  const rooms = new Map();
  const reply = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  async function body(req) {
    let input = ''; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 65536) throw new Error('request too large'); input += chunk; }
    return JSON.parse(input || '{}');
  }
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://' + req.headers.host);
      if (url.pathname.startsWith('/api/')) {
        if (req.headers.origin && req.headers.origin !== url.origin) return reply(res, 403, { error: 'same-origin requests only' });
        if (url.pathname === '/api/status' && req.method === 'GET') return reply(res, 200, { service: 'wick-local-relay', version: '2.1' });
        const roomId = req.headers['x-wick-room']; const device = req.headers['x-wick-device'];
        if (!/^[a-zA-Z0-9-]{16,80}$/.test(roomId || '') || !/^[a-zA-Z0-9_-]{8,80}$/.test(device || '')) return reply(res, 400, { error: 'invalid room or device' });
        const now = Date.now();
        for (const [id, room] of rooms) if (now - room.lastUsed > 3600000) rooms.delete(id);
        if (!rooms.has(roomId)) {
          if (rooms.size >= 32) return reply(res, 503, { error: 'room limit reached' });
          rooms.set(roomId, { messages: new Map(), lastUsed: now });
        }
        const room = rooms.get(roomId); room.lastUsed = now;
        for (const [id, m] of room.messages) if (now - m.createdAt > 3600000) room.messages.delete(id);
        if (url.pathname === '/api/send' && req.method === 'POST') {
          const data = await body(req);
          if (!Array.isArray(data.items) || data.items.length > 12 || data.items.length < 1) return reply(res, 400, { error: 'invalid batch' });
          for (const item of data.items) {
            if (!/^[a-zA-Z0-9_-]{1,100}$/.test(item.id || '') || !Array.isArray(item.frame) || item.frame.length < 2 || item.frame.length > 4096 || !item.frame.every(b => Number.isInteger(b) && b >= 0 && b <= 255)) return reply(res, 400, { error: 'invalid frame' });
          }
          const fresh = data.items.filter(i => !room.messages.has(device + ':' + i.id));
          if (room.messages.size + fresh.length > 500) return reply(res, 503, { error: 'room full; create another room' });
          for (const item of fresh) room.messages.set(device + ':' + item.id, { id: item.id, sender: device, frame: item.frame, priority: item.priority === 3 ? 3 : 1, createdAt: now, offered: new Set(), acknowledged: new Set() });
          return reply(res, 202, { accepted: data.items.map(i => i.id) });
        }
        if (url.pathname === '/api/inbox' && req.method === 'GET') {
          const items = [...room.messages.values()].filter(m => m.sender !== device && !m.acknowledged.has(device)).sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt).slice(0, 50);
          for (const m of items) m.offered.add(device);
          return reply(res, 200, { items: items.map(({ id, sender, frame, priority, createdAt }) => ({ id, sender, frame, priority, createdAt })) });
        }
        if (url.pathname === '/api/ack' && req.method === 'POST') {
          const data = await body(req);
          if (!Array.isArray(data.items) || data.items.length > 50) return reply(res, 400, { error: 'invalid receipts' });
          for (const i of data.items) {
            const m = room.messages.get(i.sender + ':' + i.id);
            if (m && m.sender !== device && m.offered.has(device)) m.acknowledged.add(device);
          }
          return reply(res, 200, { ok: true });
        }
        if (url.pathname === '/api/receipts' && req.method === 'GET') return reply(res, 200, { acknowledged: [...room.messages.values()].filter(m => m.sender === device && m.acknowledged.size).map(m => m.id) });
        return reply(res, 404, { error: 'unknown endpoint' });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, { error: 'method not allowed' });
      if (url.pathname === '/tests/__result') { res.writeHead(204); return res.end(); }
      const name = decodeURIComponent(url.pathname).replace(/\/$/, '/index.html');
      const file = path.resolve(ROOT, '.' + name);
      if (!file.startsWith(ROOT + path.sep) || name.split(/[\\/]/).some(p => p.startsWith('.'))) return reply(res, 403, { error: 'forbidden' });
      const bytes = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) { reply(res, error.code === 'ENOENT' ? 404 : 400, { error: 'request could not be processed' }); }
  });
}
module.exports = { createServer };
if (require.main === module) {
  const lan = process.argv.includes('--lan');
  const port = Number(process.env.PORT || 8127);
  const localUrl = `http://127.0.0.1:${port}/?lang=zh`;
  const server = createServer();
  server.on('error', e => {
    console.error(e.message);
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. If wick is already running, open ${localUrl}`);
      console.error('Otherwise choose another port: PORT=8128 node tools/serve.cjs --open (macOS).');
    }
    process.exitCode = 1;
  });
  server.listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
    console.log(`wick 2.1: ${localUrl}`);
    console.log('Keep this terminal open while using wick. / 使用期间请保持此终端开启。');
    if (lan) for (const rows of Object.values(os.networkInterfaces())) for (const row of rows || []) if (row.family === 'IPv4' && !row.internal) console.log(`LAN demo: http://${row.address}:${port}/?lang=zh#offline`);
    console.log('Relay: shared-room demo, plaintext on HTTP, memory retained at most 1 hour. Ctrl+C stops.');
    if (lan) console.log('LAN HTTP does not enable Service Worker. Verify offline caching on localhost or HTTPS.');
    if (process.argv.includes('--open') && process.platform === 'darwin') {
      const opener = require('node:child_process').spawn('/usr/bin/open', [localUrl], { stdio: 'ignore' });
      opener.on('error', () => console.error(`Open this address in your browser: ${localUrl}`));
    }
  });
}
