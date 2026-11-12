import fs from 'node:fs/promises';
import path from 'node:path';
import { generatePdf } from './pdf.mjs';
import { validate } from './model.mjs';

export function createHandler({ root, port, store, logo, exportsDirectory }) {
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.pdf': 'application/pdf' };
const staticFiles = new Map([['/', 'public/index.html'], ['/app.mjs', 'public/app.mjs'], ['/styles.css', 'public/styles.css'], ['/model.mjs', 'app/model.mjs'], ['/assets/impress-logo.jpg', 'public/assets/impress-logo.jpg'], ['/favicon.svg', 'public/favicon.svg']]);
async function body(request) { let bytes = 0; const chunks = []; for await (const chunk of request) { bytes += chunk.length; if (bytes > 2000000) { const error = new Error('El archivo supera los 2 MB.'); error.status = 413; throw error; } chunks.push(chunk); } try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { const error = new Error('El contenido no es JSON válido.'); error.status = 400; throw error; } }
return async (request, response) => {
  const send = (status, data, type = 'application/json; charset=utf-8', headers = {}) => { response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers }); response.end(Buffer.isBuffer(data) || typeof data === 'string' ? data : JSON.stringify(data)); };
  try {
    const host = request.headers.host;
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host)) return send(403, { error: 'Host no permitido.' });
    if (request.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(request.headers.origin)) return send(403, { error: 'Origen no permitido.' });
    const url = new URL(request.url, `http://${host}`);
    if (request.method === 'GET' && staticFiles.has(url.pathname)) {
      const file = path.join(root, staticFiles.get(url.pathname)); return send(200, await fs.readFile(file), types[path.extname(file)], { 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; object-src 'self' blob:; base-uri 'none'; frame-ancestors 'none'" });
    }
    if (request.method === 'GET' && url.pathname === '/api/state') return send(200, await store.read());
    if (request.method === 'GET' && url.pathname === '/api/history') return send(200, await store.history());
    if (request.method === 'GET' && url.pathname.startsWith('/api/version/')) return send(200, await store.version(url.pathname.split('/').at(-1)));
    if (request.method === 'PUT' && url.pathname === '/api/state') { const payload = await body(request); return send(200, await store.save(payload.state, payload.expectedRevision, payload.label)); }
    if (request.method === 'POST' && url.pathname === '/api/preview') {
      const state = await body(request); const errors = validate(state); if (errors.length) return send(422, { error: errors.join('\n') });
      return send(200, generatePdf(state, logo), 'application/pdf');
    }
    if (request.method === 'POST' && url.pathname === '/api/export') {
      const payload = await body(request); const state = await store.version(payload.revision);
      const bytes = generatePdf(state, logo);
      // Every export gets its own local-time suffix; existing PDFs are never overwritten.
      const now = new Date(), pad = value => String(value).padStart(2, '0');
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      let file;
      for (let attempt = 1; ; attempt++) {
        file = `Impress-tarifa-${state.revision}-${stamp}${attempt > 1 ? `-${attempt}` : ''}.pdf`;
        try { await fs.writeFile(path.join(exportsDirectory, file), bytes, { flag: 'wx' }); break; } catch (error) { if (error.code !== 'EEXIST') throw error; }
      }
      return send(200, { file, url: `/exports/${file}`, revision: state.revision });
    }
    if (request.method === 'GET' && /^\/exports\/Impress-tarifa-[a-zA-Z0-9_-]+\.pdf$/.test(url.pathname)) {
      const name = path.basename(url.pathname); return send(200, await fs.readFile(path.join(exportsDirectory, name)), 'application/pdf', { 'Content-Disposition': `inline; filename="${name}"` });
    }
    send(404, { error: 'No se encuentra este recurso.' });
  } catch (error) { send(error.status || (error.code === 'ENOENT' ? 404 : 400), { error: error.message || 'No se pudo completar la operación.' }); }
};
}
