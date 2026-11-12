import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { startServer } from '../app/server.mjs';
import { inspectDataDirectory } from '../app/store.mjs';

const port = 4173, origin = `http://127.0.0.1:${port}`;
const releasesUrl = 'https://github.com/zreedeecom/tariPRO/releases/latest';
const syncAttempts = 3, syncDelay = 10000;

// Lets tests and manual checks run with their own settings and drafts instead of the real ones.
if (process.env.TARIPRO_USER_DATA) app.setPath('userData', path.resolve(process.env.TARIPRO_USER_DATA));

let mainWindow = null, dataDirectory = null, exportsDirectory = null, pendingDirectory = null, running = false;
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const readSettings = () => fs.readFile(settingsFile(), 'utf8').then(JSON.parse, () => ({}));
async function writeSettings(changes) {
  const settings = { ...await readSettings(), ...changes };
  await fs.mkdir(path.dirname(settingsFile()), { recursive: true }); await fs.writeFile(settingsFile(), JSON.stringify(settings, null, 2) + '\n');
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const message = (options, parent = mainWindow) => parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options);

// Returns why the folder can't be used, or null. Writing a probe file is the only reliable test on both systems.
async function folderProblem(directory) {
  const probe = path.join(directory, `.taripro-${process.pid}.tmp`);
  try { await fs.writeFile(probe, ''); await fs.unlink(probe); return null; }
  catch (error) { return error.code === 'ENOENT' ? `La carpeta de datos ya no existe:\n${directory}` : `No se puede escribir en la carpeta de datos:\n${directory}`; }
}

async function pickFolder(reason) {
  if (reason) await message({ type: 'warning', message: 'Elige la carpeta de datos', detail: reason, buttons: ['Elegir carpeta…'] });
  const { canceled, filePaths } = await dialog.showOpenDialog({ title: 'Carpeta de datos de tariPRO', buttonLabel: 'Usar esta carpeta', properties: ['openDirectory', 'createDirectory'] });
  return canceled ? null : filePaths[0];
}

// Resolves a usable data folder (asking for one if needed) or null when the user cancels.
async function resolveDataDirectory() {
  let directory = (await readSettings()).dataDirectory;
  let reason = directory ? null : 'tariPRO guarda el catálogo, sus versiones y los PDF en una carpeta que eliges tú. Para usarla en varios ordenadores, elige una carpeta sincronizada (Dropbox, pCloud…) disponible sin conexión.';
  for (;;) {
    if (directory) {
      reason = await folderProblem(directory);
      if (!reason) {
        if (await inspectDataDirectory(directory) !== 'empty') break;
        const { response } = await message({ type: 'question', message: 'Esta carpeta está vacía. ¿Crear un catálogo nuevo aquí?', detail: `${directory}\n\nSi tus datos están en una carpeta sincronizada que aún no ha terminado de descargarse, responde que no y espera a que termine.`, buttons: ['Crear catálogo', 'No'], defaultId: 1, cancelId: 1 });
        if (response === 0) break;
        reason = null;
      }
    }
    directory = await pickFolder(reason); if (!directory) return null;
    reason = null;
  }
  await writeSettings({ dataDirectory: directory });
  return directory;
}

function statusWindow(text) {
  const window = new BrowserWindow({ width: 460, height: 160, resizable: false, minimizable: false, maximizable: false, title: 'tariPRO', show: false });
  window.setMenuBarVisibility(false);
  let closing = false;
  // Closing the waiting window by hand means "quit".
  window.on('closed', () => { if (!closing) app.exit(0); });
  const show = body => window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><meta charset="utf-8"><body style="font:15px/1.5 -apple-system,'Segoe UI',sans-serif;margin:28px;color:#111"><p>${body}</p>`)}`);
  show(text).then(() => window.show());
  return { update: show, close: () => { closing = true; window.destroy(); } };
}

// Saved versions without current.json usually mean the sync is still running: wait, never write.
async function waitForSync(directory) {
  for (;;) {
    let waiting = null;
    for (let attempt = 1; attempt <= syncAttempts && await inspectDataDirectory(directory) === 'incomplete'; attempt++) {
      const text = `Esperando a que termine la sincronización de la carpeta de datos… (intento ${attempt} de ${syncAttempts})`;
      if (waiting) waiting.update(text); else waiting = statusWindow(text);
      await sleep(syncDelay);
    }
    waiting?.close();
    if (await inspectDataDirectory(directory) !== 'incomplete') return true;
    const { response } = await message({ type: 'warning', message: 'La carpeta de datos está incompleta', detail: `Falta el catálogo actual (current.json), pero la carpeta tiene versiones guardadas:\n${directory}\n\nPuede que Dropbox u otro servicio no haya terminado de sincronizar. Por seguridad, tariPRO no crea ni modifica nada. Comprueba que la sincronización está en marcha y vuelve a intentarlo.`, buttons: ['Reintentar', 'Salir'], defaultId: 0, cancelId: 1 });
    if (response === 1) return false;
  }
}

async function start() {
  for (;;) {
    if (!await waitForSync(dataDirectory)) return null;
    try { return await startServer({ dataDirectory, exportsDirectory, port }); }
    catch (error) {
      if (error.code === 'INCOMPLETE_DATA') continue;
      if (error.code === 'NEWER_DATA') {
        const { response } = await message({ type: 'warning', message: 'Datos de una versión más nueva', detail: `${error.message}\n\n${dataDirectory}`, buttons: ['Descargar la versión nueva', 'Salir'], defaultId: 0, cancelId: 1 });
        if (response === 0) await shell.openExternal(releasesUrl);
        return null;
      }
      const detail = error.code === 'EADDRINUSE' ? `El puerto ${port} está ocupado: probablemente hay otra copia de tariPRO abierta (o \`npm start\`). Ciérrala y vuelve a abrir la app.` : error.message;
      await message({ type: 'error', message: 'No se pudo abrir tariPRO', detail, buttons: ['Salir'] });
      return null;
    }
  }
}

// The new folder is only stored once the window really closes (unsaved changes may cancel it); the relaunch then runs the usual checks.
async function changeDataDirectory() {
  const directory = await pickFolder(null); if (!directory) return;
  pendingDirectory = directory; mainWindow.close();
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const dataItems = [{ label: 'Cambiar carpeta de datos…', click: changeDataDirectory }, { label: 'Mostrar carpeta de datos', click: () => shell.openPath(dataDirectory) }];
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{ role: 'appMenu' }] : []),
    { label: 'Archivo', submenu: [...dataItems, { type: 'separator' }, mac ? { role: 'close', label: 'Cerrar ventana' } : { role: 'quit', label: 'Salir' }] },
    { role: 'editMenu', label: 'Edición' },
    { label: 'Ver', submenu: [{ role: 'reload', label: 'Recargar' }, { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }, { type: 'separator' }, { role: 'resetZoom', label: 'Tamaño real' }, { role: 'zoomIn', label: 'Ampliar' }, { role: 'zoomOut', label: 'Reducir' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Pantalla completa' }] },
    { role: 'windowMenu', label: 'Ventana' }
  ]));
}

function openMainWindow() {
  mainWindow = new BrowserWindow({ width: 1440, height: 900, minWidth: 1024, minHeight: 640, title: 'tariPRO', show: false });
  const contents = mainWindow.webContents;
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${origin}/`) || url.startsWith('blob:')) return { action: 'allow' };
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => { if (!url.startsWith(`${origin}/`)) event.preventDefault(); });
  // Unsaved changes: the page's beforeunload would silently block closing, so ask instead. The draft stays recoverable.
  contents.on('will-prevent-unload', event => {
    const response = dialog.showMessageBoxSync(mainWindow, { type: 'question', message: 'Hay cambios sin guardar', detail: 'Se conservan como borrador y podrás recuperarlos al volver a abrir tariPRO.', buttons: ['Cerrar', 'Cancelar'], defaultId: 1, cancelId: 1 });
    if (response === 0) event.preventDefault(); else pendingDirectory = null;
  });
  // PDFs exported by the server are already in exports/: open that file instead of downloading a copy.
  contents.session.on('will-download', (event, item) => {
    const match = item.getURL().match(/^http:\/\/127\.0\.0\.1:\d+\/exports\/(Impress-tarifa-[a-zA-Z0-9_-]+\.pdf)$/);
    if (match) { event.preventDefault(); shell.openPath(path.join(exportsDirectory, match[1])); }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  // PDF windows opened from the app close with it, so the app really quits (and frees the port and the lock).
  mainWindow.on('closed', () => { mainWindow = null; for (const window of BrowserWindow.getAllWindows()) window.close(); });
  return mainWindow.loadURL(`${origin}/`);
}

async function main() {
  await app.whenReady();
  dataDirectory = await resolveDataDirectory();
  exportsDirectory = dataDirectory && path.join(dataDirectory, 'exports');
  const started = dataDirectory && await start();
  if (!started) return app.exit(0);
  running = true; buildMenu();
  await openMainWindow();
  const conflicts = await started.store.conflicts();
  if (conflicts.length) await message({ type: 'warning', message: 'Hay copias en conflicto en la carpeta de datos', detail: `Las ha creado el servicio de sincronización al guardar en dos ordenadores a la vez. tariPRO no las toca; revísalas y bórralas a mano cuando sepas cuál vale.\n\n${conflicts.join('\n')}` });
}

// Before the main window exists, the waiting window may close while dialogs are still to come: that must not quit.
app.on('window-all-closed', async () => {
  if (!running) return;
  if (pendingDirectory) { await writeSettings({ dataDirectory: pendingDirectory }); app.relaunch(); }
  app.quit();
});
app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
if (app.requestSingleInstanceLock()) main().catch(error => { dialog.showErrorBox('No se pudo abrir tariPRO', error.message); app.exit(1); }); else app.exit(0);
