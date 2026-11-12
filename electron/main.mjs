import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../app/server.mjs';
import { inspectDataDirectory } from '../app/store.mjs';
import { compareVersions, pickInstaller, changelogSection, markdownToHtml, plainNotes } from './release.mjs';

const port = 4173, origin = `http://127.0.0.1:${port}`;
const releasesUrl = 'https://github.com/zreedeecom/tariPRO/releases/latest', releasesApi = 'https://api.github.com/repos/zreedeecom/tariPRO/releases/latest';
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const syncAttempts = 3, syncDelay = 10000;

// Lets tests and manual checks run with their own settings and drafts instead of the real ones.
if (process.env.TARIPRO_USER_DATA) app.setPath('userData', path.resolve(process.env.TARIPRO_USER_DATA));

// Lets manual checks pretend to be an older app so the update notice shows up.
const currentVersion = () => process.env.TARIPRO_FAKE_VERSION || app.getVersion();

let notesWindow = null, mainWindow = null, dataDirectory = null, exportsDirectory = null, pendingDirectory = null, running = false;
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
        if (response === 0) await shell.openExternal(installerUrl(await latestRelease()));
        return null;
      }
      const detail = error.code === 'EADDRINUSE' ? `El puerto ${port} está ocupado: probablemente hay otra copia de tariPRO abierta (o \`npm start\`). Ciérrala y vuelve a abrir la app.` : error.message;
      await message({ type: 'error', message: 'No se pudo abrir tariPRO', detail, buttons: ['Salir'] });
      return null;
    }
  }
}

// Drafts are not tied to a folder, so changing folders with one pending could mix catalogs: save or discard first.
// The new folder is only stored once the window really closes; the relaunch then runs the usual checks.
async function changeDataDirectory() {
  if (await mainWindow.webContents.executeJavaScript('window.hasUnsavedChanges?.() ?? false')) {
    await message({ type: 'info', message: 'Hay cambios sin guardar', detail: 'Guarda una versión o descarta el borrador antes de cambiar de carpeta de datos.', buttons: ['Entendido'] });
    return;
  }
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { title: 'Carpeta de datos de tariPRO', buttonLabel: 'Usar esta carpeta', properties: ['openDirectory', 'createDirectory'] });
  if (canceled || filePaths[0] === dataDirectory) return;
  pendingDirectory = filePaths[0]; mainWindow.close();
}

// Latest published release on GitHub (drafts are not listed), or null when offline or on any error.
async function latestRelease() {
  try { const response = await fetch(releasesApi, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(5000) }); return response.ok ? await response.json() : null; }
  catch { return null; }
}
// An Intel build running under Rosetta still gets the Apple Silicon installer.
const installerUrl = release => pickInstaller(release?.assets, process.platform, app.runningUnderARM64Translation ? 'arm64' : process.arch) ?? release?.html_url ?? releasesUrl;

async function checkForUpdate() {
  const release = await latestRelease();
  if (!release?.tag_name || compareVersions(release.tag_name, currentVersion()) <= 0) return;
  const { response } = await message({ type: 'info', message: `Hay una versión nueva de tariPRO: ${release.tag_name.replace(/^v/, '')}`, detail: `Tienes la ${currentVersion()}. Descarga el instalador y ábrelo para actualizar; tus datos no se tocan.\n\n${plainNotes(release.body || '')}`, buttons: ['Descargar', 'Ahora no'], defaultId: 0, cancelId: 1 });
  if (response === 0) await shell.openExternal(installerUrl(release));
}

// CHANGELOG.md ships with the app; without a version it shows every released section.
async function showChangelog(version) {
  const markdown = changelogSection(await fs.readFile(path.join(appRoot, 'CHANGELOG.md'), 'utf8'), version);
  if (!markdown) return;
  notesWindow?.destroy();
  notesWindow = new BrowserWindow({ width: 680, height: 720, minWidth: 420, minHeight: 320, title: 'Novedades de tariPRO', show: false });
  notesWindow.setMenuBarVisibility(false);
  const external = url => { if (/^https?:\/\//.test(url)) shell.openExternal(url); };
  notesWindow.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
  notesWindow.webContents.on('will-navigate', (event, url) => { event.preventDefault(); external(url); });
  notesWindow.once('ready-to-show', () => notesWindow.show());
  notesWindow.on('closed', () => { notesWindow = null; });
  const style = `body{font:14px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#17201e;background:#fff;margin:0;padding:8px 32px 32px}h1{font-size:22px}h2{font-size:18px;margin:28px 0 4px;padding-top:20px;border-top:3px solid #f45113}h2:first-child{margin-top:16px}h3{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#c43b0c;margin:18px 0 6px}ul{padding-left:20px;margin:0}li{margin:4px 0}code{font:12px ui-monospace,Menlo,Consolas,monospace;background:#f6f7f5;padding:1px 4px;border-radius:4px}a{color:#c43b0c}`;
  await notesWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Novedades de tariPRO</title><style>${style}</style>${markdownToHtml(markdown)}`)}`);
}

// The first launch after an update shows what changed in that version (not on a fresh install).
async function showNewsOnce() {
  const { lastSeenVersion } = await readSettings(), version = app.getVersion();
  if (lastSeenVersion === version) return;
  await writeSettings({ lastSeenVersion: version });
  if (lastSeenVersion) await showChangelog(version);
}

async function showAbout() {
  const { response } = await message({ type: 'info', message: `tariPRO ${app.getVersion()}`, detail: `Tarifa profesional de impresión digital.\n\nCarpeta de datos:\n${dataDirectory}\n\nCreado por Luis Giménez (Impress Marketing).\ngithub.com/zreedeecom/tariPRO`, buttons: ['Aceptar', 'Mostrar carpeta de datos', 'Novedades'], defaultId: 0, cancelId: 0 });
  if (response === 1) shell.openPath(dataDirectory);
  if (response === 2) showChangelog();
}

function buildMenu() {
  const mac = process.platform === 'darwin';
  const about = { label: 'Acerca de tariPRO', click: showAbout };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{ label: app.name, submenu: [about, { type: 'separator' }, { role: 'services', label: 'Servicios' }, { type: 'separator' }, { role: 'hide', label: 'Ocultar tariPRO' }, { role: 'hideOthers', label: 'Ocultar otros' }, { role: 'unhide', label: 'Mostrar todo' }, { type: 'separator' }, { role: 'quit', label: 'Salir de tariPRO' }] }] : []),
    { label: 'Archivo', submenu: [{ label: 'Cambiar carpeta de datos…', click: changeDataDirectory }, { label: 'Mostrar carpeta de datos', click: () => shell.openPath(dataDirectory) }, { type: 'separator' }, mac ? { role: 'close', label: 'Cerrar ventana' } : { role: 'quit', label: 'Salir' }] },
    { label: 'Edición', submenu: [{ role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, { type: 'separator' }, { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' }] },
    { label: 'Ver', submenu: [{ role: 'reload', label: 'Recargar' }, { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }, { type: 'separator' }, { role: 'resetZoom', label: 'Tamaño real' }, { role: 'zoomIn', label: 'Ampliar' }, { role: 'zoomOut', label: 'Reducir' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Pantalla completa' }] },
    { label: 'Ventana', submenu: [{ role: 'minimize', label: 'Minimizar' }, ...(mac ? [{ role: 'zoom', label: 'Zoom' }, { type: 'separator' }, { role: 'front', label: 'Traer todo al frente' }] : [])] },
    { role: 'help', label: 'Ayuda', submenu: [{ label: 'Novedades', click: () => showChangelog() }, ...(mac ? [] : [{ type: 'separator' }, about])] }
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
  await showNewsOnce();
  await checkForUpdate();
}

// Before the main window exists, the waiting window may close while dialogs are still to come: that must not quit.
app.on('window-all-closed', async () => {
  if (!running) return;
  if (pendingDirectory) { await writeSettings({ dataDirectory: pendingDirectory }); app.relaunch(); }
  app.quit();
});
app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
if (app.requestSingleInstanceLock()) main().catch(error => { dialog.showErrorBox('No se pudo abrir tariPRO', error.message); app.exit(1); }); else app.exit(0);
