import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CatalogStore } from './app/store.mjs';
import { createHandler } from './app/http.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const dataDirectory = process.env.IMPRESS_DATA_DIR ? path.resolve(process.env.IMPRESS_DATA_DIR) : path.join(root, 'data');
const exportsDirectory = process.env.IMPRESS_EXPORT_DIR ? path.resolve(process.env.IMPRESS_EXPORT_DIR) : path.join(root, 'exports');
const store = new CatalogStore(dataDirectory, path.join(root, 'app/empty-catalog.json'));
await store.initialize(); await fs.mkdir(exportsDirectory, { recursive: true });
const logo = await fs.readFile(path.join(root, 'public/assets/impress-logo.jpg'));
const server = http.createServer(createHandler({ root, port, store, logo, exportsDirectory }));
server.listen(port, '127.0.0.1', () => console.log(`tariPRO · http://127.0.0.1:${port}\nDatos: ${dataDirectory}\nPDF: ${exportsDirectory}\nCtrl+C para detener.`));
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} está ocupado. Cierra la otra instancia o cambia PORT.` : error.message); process.exitCode = 1; });
