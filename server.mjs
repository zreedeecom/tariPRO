import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './app/server.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const dataDirectory = process.env.IMPRESS_DATA_DIR ? path.resolve(process.env.IMPRESS_DATA_DIR) : path.join(root, 'data');
const exportsDirectory = process.env.IMPRESS_EXPORT_DIR ? path.resolve(process.env.IMPRESS_EXPORT_DIR) : path.join(root, 'exports');
try {
  const { store } = await startServer({ dataDirectory, exportsDirectory, port });
  console.log(`tariPRO · http://127.0.0.1:${port}\nDatos: ${dataDirectory}\nPDF: ${exportsDirectory}\nCtrl+C para detener.`);
  const conflicts = await store.conflicts();
  if (conflicts.length) console.warn(`\nAviso: copias en conflicto en la carpeta de datos (revísalas a mano):\n${conflicts.map(name => `- ${name}`).join('\n')}`);
} catch (error) {
  console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} está ocupado. Cierra la otra instancia o cambia PORT.` : error.message); process.exitCode = 1;
}
