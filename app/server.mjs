import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CatalogStore } from './store.mjs';
import { createHandler } from './http.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Shared by `npm start` and Electron. Rejects with the listen error (e.g. EADDRINUSE) so each caller reports it its own way.
export async function startServer({ dataDirectory, exportsDirectory, port = 4173 }) {
  const store = new CatalogStore(dataDirectory, path.join(root, 'app/empty-catalog.json'));
  await store.initialize(); await fs.mkdir(exportsDirectory, { recursive: true });
  const logo = await fs.readFile(path.join(root, 'public/assets/impress-logo.jpg'));
  const server = http.createServer(createHandler({ root, port, store, logo, exportsDirectory }));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  return server;
}
