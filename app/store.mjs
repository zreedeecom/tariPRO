import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validate, materialize, migrate } from './model.mjs';

export class CatalogStore {
  constructor(directory, seedPath) { this.directory = directory; this.seedPath = seedPath; this.queue = Promise.resolve(); }
  async initialize() {
    await fs.mkdir(path.join(this.directory, 'versions'), { recursive: true });
    try { await fs.access(path.join(this.directory, 'current.json')); }
    catch {
      const initial = JSON.parse(await fs.readFile(this.seedPath, 'utf8'));
      await fs.writeFile(path.join(this.directory, 'versions', 'initial.json'), JSON.stringify(initial, null, 2) + '\n', { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
      await this.atomicWrite(initial);
    }
    const state = await this.read();
    const errors = validate(state); if (errors.length) throw new Error(`El catálogo guardado no es válido: ${errors.join(' ')}`);
  }
  // Older catalogs on disk stay untouched; they are upgraded in memory when read.
  read() { return fs.readFile(path.join(this.directory, 'current.json'), 'utf8').then(text => migrate(JSON.parse(text))); }
  async atomicWrite(state) {
    const temporary = path.join(this.directory, `.current-${randomUUID()}.tmp`);
    try { await fs.writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { flag: 'wx' }); await fs.rename(temporary, path.join(this.directory, 'current.json')); }
    finally { await fs.unlink(temporary).catch(() => {}); }
  }
  save(state, expectedRevision, label) {
    const operation = this.queue.then(async () => {
      const current = await this.read();
      if (current.revision !== expectedRevision) { const error = new Error('El catálogo cambió en otra pestaña. Exporta tu borrador y recarga antes de guardar.'); error.status = 409; throw error; }
      const errors = validate(state); if (errors.length) { const error = new Error(errors.join('\n')); error.status = 422; throw error; }
      const next = materialize(state); next.revision = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
      next.savedAt = new Date().toISOString(); next.versionLabel = String(label || 'Actualización de tarifa').trim().slice(0, 100);
      await fs.writeFile(path.join(this.directory, 'versions', `${next.revision}.json`), JSON.stringify(next, null, 2) + '\n', { flag: 'wx' });
      await this.atomicWrite(next); return next;
    });
    this.queue = operation.catch(() => {}); return operation;
  }
  async version(id) { if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Versión no válida.'); return migrate(JSON.parse(await fs.readFile(path.join(this.directory, 'versions', `${id}.json`), 'utf8'))); }
  async history() {
    const names = (await fs.readdir(path.join(this.directory, 'versions'))).filter(name => name.endsWith('.json'));
    const items = await Promise.all(names.map(async name => { const state = await this.version(name.slice(0, -5)); return { id: state.revision, date: state.savedAt, label: state.versionLabel, materials: state.materials.length }; }));
    return items.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  }
}
