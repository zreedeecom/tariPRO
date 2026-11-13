import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validate, materialize, migrate, SCHEMA_VERSION } from './model.mjs';

const { version: appVersion } = JSON.parse(await fs.readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));

const versionFile = /^[a-zA-Z0-9_-]+\.json$/;

// 'ready' (has current.json), 'empty' (nothing saved yet) or 'incomplete' (saved versions without current.json: likely a folder still syncing).
export async function inspectDataDirectory(directory) {
  if (await fs.access(path.join(directory, 'current.json')).then(() => true, () => false)) return 'ready';
  const saved = (await fs.readdir(path.join(directory, 'versions')).catch(() => [])).filter(name => versionFile.test(name));
  return saved.length ? 'incomplete' : 'empty';
}

export class CatalogStore {
  constructor(directory, seedPath) { this.directory = directory; this.seedPath = seedPath; this.queue = Promise.resolve(); }
  async initialize() {
    const status = await inspectDataDirectory(this.directory);
    // Never seed a catalog over a half-synced folder: it would clash with the real one.
    if (status === 'incomplete') { const error = new Error('Falta el catálogo actual (current.json), pero la carpeta tiene versiones guardadas. Puede que la sincronización no haya terminado. Por seguridad, tariPRO no crea ni modifica nada.'); error.code = 'INCOMPLETE_DATA'; error.status = 409; throw error; }
    await fs.mkdir(path.join(this.directory, 'versions'), { recursive: true });
    if (status === 'empty') {
      const initial = JSON.parse(await fs.readFile(this.seedPath, 'utf8'));
      await fs.writeFile(path.join(this.directory, 'versions', 'initial.json'), JSON.stringify(initial, null, 2) + '\n', { flag: 'wx' });
      await this.atomicWrite(initial);
    }
    const state = await this.read();
    const errors = validate(state); if (errors.length) throw new Error(`El catálogo guardado no es válido: ${errors.join(' ')}`);
  }
  // Older catalogs on disk stay untouched; they are upgraded in memory when read. Newer ones are refused, so this app never edits or overwrites them.
  async read() {
    const state = JSON.parse(await fs.readFile(path.join(this.directory, 'current.json'), 'utf8'));
    if (state?.schemaVersion > SCHEMA_VERSION) { const error = new Error('Estos datos se guardaron con una versión más nueva de tariPRO. Instala la última versión para abrirlos.'); error.code = 'NEWER_DATA'; error.status = 409; throw error; }
    return migrate(state);
  }
  async atomicWrite(state) {
    const temporary = path.join(this.directory, `.current-${randomUUID()}.tmp`);
    try { await fs.writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { flag: 'wx' }); await fs.rename(temporary, path.join(this.directory, 'current.json')); }
    finally { await fs.unlink(temporary).catch(() => {}); }
  }
  save(state, expectedRevision, label) {
    const operation = this.queue.then(async () => {
      const current = await this.read();
      if (current.revision !== expectedRevision) { const error = new Error('El catálogo cambió en otra pestaña. Exporta tu borrador y recarga antes de guardar.'); error.status = 409; error.code = 'STALE'; throw error; }
      const errors = validate(state); if (errors.length) { const error = new Error(errors.join('\n')); error.status = 422; throw error; }
      const next = materialize(state); next.revision = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
      next.savedAt = new Date().toISOString(); next.versionLabel = String(label || 'Actualización de tarifa').trim().slice(0, 100); next.savedWith = appVersion;
      await fs.writeFile(path.join(this.directory, 'versions', `${next.revision}.json`), JSON.stringify(next, null, 2) + '\n', { flag: 'wx' });
      await this.atomicWrite(next); return next;
    });
    this.queue = operation.catch(() => {}); return operation;
  }
  // Moves a saved version to papelera/ untouched; the current one stays. The app never empties papelera/.
  remove(id) {
    const operation = this.queue.then(async () => {
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Versión no válida.');
      if ((await this.read()).revision === id) { const error = new Error('La versión vigente no se puede borrar.'); error.status = 409; throw error; }
      await fs.mkdir(path.join(this.directory, 'papelera'), { recursive: true });
      try { await fs.rename(path.join(this.directory, 'versions', `${id}.json`), path.join(this.directory, 'papelera', `${id}.json`)); }
      catch (error) { if (error.code === 'ENOENT') { const missing = new Error('Esta versión ya no existe; puede que se haya borrado desde otro ordenador.'); missing.status = 404; throw missing; } throw error; }
    });
    this.queue = operation.catch(() => {}); return operation;
  }
  // Deleted versions are still read from papelera/: a recovered draft may start from one.
  async version(id) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Versión no válida.');
    const read = folder => fs.readFile(path.join(this.directory, folder, `${id}.json`), 'utf8');
    return migrate(JSON.parse(await read('versions').catch(error => { if (error.code === 'ENOENT') return read('papelera'); throw error; })));
  }
  // Cheap check for changes saved elsewhere.
  async revision() { const { revision, versionLabel, savedAt } = await this.read(); return { revision, versionLabel, savedAt }; }
  async history() {
    const names = (await fs.readdir(path.join(this.directory, 'versions'))).filter(name => versionFile.test(name));
    const items = await Promise.all(names.map(async name => { const state = await this.version(name.slice(0, -5)); return { id: state.revision, date: state.savedAt, label: state.versionLabel, materials: state.materials.length }; }));
    return items.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  }
  // Conflicted copies left by Dropbox ("conflicted copy", "copia en conflicto") or pCloud ("[conflicted]"), only in the folders the app owns.
  async conflicts() {
    const names = await Promise.all(['', 'versions', 'exports'].map(folder => fs.readdir(path.join(this.directory, folder)).then(items => items.map(name => path.join(folder, name)), () => [])));
    return names.flat().filter(name => /conflict/i.test(path.basename(name))).sort();
  }
}
