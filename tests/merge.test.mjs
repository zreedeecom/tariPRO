import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clone, basePrice, validate } from '../app/model.mjs';
import { mergeCatalogs, equal } from '../app/merge.mjs';

const seed = JSON.parse(fs.readFileSync(new URL('./fixtures/sample-catalog.json', import.meta.url)));
const saved = (state, label) => ({ ...state, revision: `rev-${label}`, savedAt: '2026-11-13T10:00:00.000Z', versionLabel: label });
const material = (state, id) => state.materials.find(item => item.id === id);
const finish = (state, id) => state.finishes.find(item => item.id === id);
const newMaterial = (id, name) => ({ ...clone(seed.materials[0]), id, name, rolls: [] });

test('Equality ignores key order and undefined keys', () => {
  assert.ok(equal({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1, d: undefined }));
  assert.ok(!equal([1, 2], [2, 1]));
  assert.ok(!equal({ a: null }, { a: 0 }));
});

test('Identity: without my changes the result is exactly theirs, and without theirs exactly mine', () => {
  const theirs = saved(clone(seed), 'Suya'); material(theirs, 'material-1').cost = 2.4; theirs.materials.push(newMaterial('material-x', 'Suyo'));
  let result = mergeCatalogs(seed, clone(seed), theirs);
  assert.deepEqual(result.state, theirs); assert.deepEqual(result.conflicts, []);
  assert.equal(JSON.stringify(result.state), JSON.stringify(theirs), 'same key order, so the draft is not dirty');
  const mine = clone(seed); material(mine, 'material-2').name = 'Mío'; finish(mine, 'lam-mono').supplement = 5;
  result = mergeCatalogs(seed, mine, clone(seed));
  assert.deepEqual(result.state, mine); assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.summary, { added: [], removed: [], changed: [] });
});

test('New materials on both sides all stay: theirs first, then mine', () => {
  const mine = clone(seed), theirs = saved(clone(seed), 'Suya');
  mine.materials.push(newMaterial('material-mine', 'Mío')); theirs.materials.push(newMaterial('material-theirs', 'Suyo'));
  const { state, conflicts, summary, errors } = mergeCatalogs(seed, mine, theirs);
  assert.deepEqual(state.materials.map(item => item.id).slice(-2), ['material-theirs', 'material-mine']);
  assert.deepEqual(conflicts, []); assert.deepEqual(errors, []);
  assert.deepEqual(summary.added, [{ scope: 'material', name: 'Suyo' }]);
  assert.equal(state.revision, 'rev-Suya'); assert.equal(state.versionLabel, 'Suya');
});

test('The same change on both sides is not a conflict nor an incoming change', () => {
  const mine = clone(seed), theirs = saved(clone(seed), 'Suya');
  material(mine, 'material-1').cost = 3; material(theirs, 'material-1').cost = 3;
  mine.document.title = 'Tarifa 2027'; theirs.document.title = 'Tarifa 2027';
  const { state, conflicts, summary } = mergeCatalogs(seed, mine, theirs);
  assert.equal(material(state, 'material-1').cost, 3); assert.equal(state.document.title, 'Tarifa 2027');
  assert.deepEqual(conflicts, []); assert.deepEqual(summary.changed, []);
});

test('Different fields of one material merge; the same field changed differently is a conflict that keeps mine until chosen', () => {
  const mine = clone(seed), theirs = saved(clone(seed), 'Suya');
  Object.assign(material(mine, 'material-1'), { name: 'Nombre mío', cost: 3 });
  Object.assign(material(theirs, 'material-1'), { supplier: 'Proveedor B', cost: 4 });
  let result = mergeCatalogs(seed, mine, theirs);
  const merged = material(result.state, 'material-1');
  assert.deepEqual([merged.name, merged.supplier, merged.cost], ['Nombre mío', 'Proveedor B', 3]);
  assert.deepEqual(result.conflicts, [{ key: 'material:material-1:cost', scope: 'material', id: 'material-1', name: 'Nombre mío', field: 'cost', label: 'Coste', base: 2.1, mine: 3, theirs: 4 }]);
  assert.equal(merged.price, basePrice(result.state, merged));
  result = mergeCatalogs(seed, mine, theirs, { 'material:material-1:cost': 'theirs' });
  assert.equal(material(result.state, 'material-1').cost, 4); assert.deepEqual(result.errors, []);
});

test('Base price is one unit: mode and value, and the price when it is fixed', () => {
  const mine = clone(seed), theirs = saved(clone(seed), 'Suya');
  material(mine, 'material-1').pricing = { mode: 'markup', value: 1 };
  material(theirs, 'material-1').pricing.value = 0.6;
  let result = mergeCatalogs(seed, mine, theirs);
  assert.deepEqual(result.conflicts.map(item => item.key), ['material:material-1:pricing']);
  assert.deepEqual(material(result.state, 'material-1').pricing, { mode: 'markup', value: 1 });
  result = mergeCatalogs(seed, mine, theirs, { 'material:material-1:pricing': 'theirs' });
  assert.deepEqual(material(result.state, 'material-1').pricing, { mode: 'margin', value: 0.6 });

  Object.assign(material(mine, 'material-1'), { pricing: { mode: 'fixed', value: 0 }, price: 20 });
  Object.assign(material(theirs, 'material-1'), { pricing: { mode: 'fixed', value: 0 }, price: 22, cost: 2.5 });
  result = mergeCatalogs(seed, mine, theirs, { 'material:material-1:pricing': 'theirs' });
  assert.deepEqual(result.conflicts[0].mine, { mode: 'fixed', value: 0, price: 20 });
  assert.deepEqual([material(result.state, 'material-1').price, material(result.state, 'material-1').cost], [22, 2.5]);
});

test('A merged material gets its base price from the merged fields', () => {
  const mine = clone(seed), theirs = saved(clone(seed), 'Suya');
  material(mine, 'material-1').cost = 3; material(theirs, 'material-1').pricing.value = 0.6;
  const { state, conflicts } = mergeCatalogs(seed, mine, theirs);
  const merged = material(state, 'material-1');
  assert.deepEqual(conflicts, []); assert.deepEqual([merged.cost, merged.pricing.value], [3, 0.6]);
  assert.equal(merged.price, basePrice(state, merged)); assert.notEqual(merged.price, material(seed, 'material-1').price);
  assert.deepEqual(Object.keys(merged), Object.keys(material(seed, 'material-1')), 'merged fields keep their order');
});

test('Supplements merge per finish; compatible materials and hidden rows merge as sets', () => {
  const mine = clone(seed), theirs = saved(clone(seed), 'Suya');
  const [first, second] = finish(seed, 'lam-mono').materialIds;
  finish(mine, 'lam-mono').materialIds.push('material-3'); finish(mine, 'lam-mono').name = 'Laminado mío';
  finish(theirs, 'lam-mono').materialIds = [first]; finish(theirs, 'lam-mono').cost = 2.5;
  material(mine, first).supplements['lam-mono'] = 5; material(mine, first).hiddenRows.push('die-cut');
  material(theirs, first).supplements['lam-mono'] = 6; material(theirs, first).tagline = 'Lema suyo';
  const { state, conflicts } = mergeCatalogs(seed, mine, theirs);
  assert.deepEqual(finish(state, 'lam-mono').materialIds, [first, 'material-3']);
  assert.ok(!finish(state, 'lam-mono').materialIds.includes(second));
  assert.deepEqual([finish(state, 'lam-mono').name, finish(state, 'lam-mono').cost], ['Laminado mío', 2.5]);
  assert.deepEqual(conflicts.map(item => [item.key, item.label]), [[`material:${first}:supplements.lam-mono`, 'Suplemento de Oracal 200M']]);
  assert.deepEqual(material(state, first).hiddenRows, ['die-cut']); assert.equal(material(state, first).tagline, 'Lema suyo');
});

test('A finish removed on one side goes if the other did not touch it; if the other edited it, it is a conflict', () => {
  const removed = saved(clone(seed), 'Suya'); removed.finishes = removed.finishes.filter(item => item.id !== 'lam-mono');
  for (const item of removed.materials) delete item.supplements['lam-mono'];
  const untouched = clone(seed); material(untouched, 'material-1').name = 'Mío'; finish(untouched, 'lam-poly').cost = 3;
  let result = mergeCatalogs(seed, untouched, removed);
  assert.ok(!finish(result.state, 'lam-mono')); assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.summary.removed, [{ scope: 'finish', name: 'Oracal 200M' }]);
  assert.equal(finish(result.state, 'lam-poly').cost, 3); assert.deepEqual(result.errors, []);

  const edited = clone(seed); finish(edited, 'lam-mono').cost = 3;
  result = mergeCatalogs(seed, edited, removed);
  assert.deepEqual(result.conflicts.map(item => [item.key, item.mine?.cost, item.theirs]), [['finish:lam-mono', 3, null]]);
  assert.equal(finish(result.state, 'lam-mono').cost, 3);
  result = mergeCatalogs(seed, edited, removed, { 'finish:lam-mono': 'theirs' });
  assert.ok(!finish(result.state, 'lam-mono')); assert.deepEqual(result.errors, []);

  const mineRemoved = clone(seed); mineRemoved.finishes = mineRemoved.finishes.filter(item => item.id !== 'lam-mono');
  for (const item of mineRemoved.materials) delete item.supplements['lam-mono'];
  const theirsEdited = saved(clone(seed), 'Suya'); finish(theirsEdited, 'lam-mono').cost = 4;
  result = mergeCatalogs(seed, mineRemoved, theirsEdited);
  assert.deepEqual(result.conflicts.map(item => [item.key, item.mine, item.theirs?.cost]), [['finish:lam-mono', null, 4]]);
  assert.ok(!finish(result.state, 'lam-mono'));
  result = mergeCatalogs(seed, mineRemoved, removed);
  assert.deepEqual(result.conflicts, []); assert.ok(!finish(result.state, 'lam-mono'));
  result = mergeCatalogs(seed, clone(seed), removed);
  assert.deepEqual(result.state, removed);
});

test('Per-material supplements belong to their finish: editing one while the other side removes the finish is a conflict', () => {
  const base = clone(seed); material(base, 'material-2').supplements['lam-mono'] = 4;
  const removed = saved(clone(base), 'Suya'); removed.finishes = removed.finishes.filter(item => item.id !== 'lam-mono');
  for (const item of removed.materials) delete item.supplements['lam-mono'];
  const mine = clone(base); material(mine, 'material-1').supplements['lam-mono'] = 5;
  let result = mergeCatalogs(base, mine, removed);
  assert.deepEqual(result.conflicts.map(item => item.key), ['finish:lam-mono']);
  assert.deepEqual([material(result.state, 'material-1').supplements, material(result.state, 'material-2').supplements], [{ 'lam-mono': 5 }, { 'lam-mono': 4 }], 'kept with all its supplements');
  assert.deepEqual(result.errors, []);
  result = mergeCatalogs(base, mine, removed, { 'finish:lam-mono': 'theirs' });
  assert.ok(!finish(result.state, 'lam-mono')); assert.deepEqual(result.conflicts.map(item => item.key), ['finish:lam-mono']);
  assert.deepEqual([material(result.state, 'material-1').supplements, material(result.state, 'material-2').supplements], [{}, {}]);

  const changed = clone(base); material(changed, 'material-2').supplements['lam-mono'] = 6;
  result = mergeCatalogs(base, changed, removed);
  assert.deepEqual(result.conflicts.map(item => item.key), ['finish:lam-mono'], 'no separate supplement conflict for that finish');
  assert.deepEqual(material(result.state, 'material-2').supplements, { 'lam-mono': 6 });

  const theirsChanged = saved(clone(base), 'Suya'); material(theirsChanged, 'material-2').supplements['lam-mono'] = 6;
  const mineRemoved = clone(removed); Object.assign(mineRemoved, { revision: base.revision, versionLabel: base.versionLabel, savedAt: base.savedAt });
  result = mergeCatalogs(base, mineRemoved, theirsChanged, { 'finish:lam-mono': 'theirs' });
  assert.deepEqual(result.conflicts.map(item => item.key), ['finish:lam-mono']);
  assert.deepEqual(material(result.state, 'material-2').supplements, { 'lam-mono': 6 }); assert.ok(finish(result.state, 'lam-mono'));
});

test('A finish they removed is reported when mine still had it untouched', () => {
  const removed = saved(clone(seed), 'Suya'); removed.finishes = removed.finishes.filter(item => item.id !== 'die-cut');
  const mine = clone(seed); material(mine, 'material-1').name = 'Mío';
  const { summary, conflicts } = mergeCatalogs(seed, mine, removed);
  assert.deepEqual(conflicts, []); assert.deepEqual(summary.removed, [{ scope: 'finish', name: finish(seed, 'die-cut').name }]);
});

test('Settings and document merge field by field; discount tiers and condition lists are one unit', () => {
  const mine = clone(seed), theirs = saved(clone(seed), 'Suya');
  mine.document.title = 'Título mío'; theirs.document.edition = 'Edición suya'; theirs.settings.setupCost = 2;
  mine.settings.tiers[0].rate = 0.06; theirs.settings.tiers[2].rate = 0.2;
  mine.document.notes.push('Nota mía'); theirs.document.notes.shift();
  const { state, conflicts, summary, errors } = mergeCatalogs(seed, mine, theirs);
  assert.deepEqual([state.document.title, state.document.edition, state.settings.setupCost], ['Título mío', 'Edición suya', 2]);
  assert.deepEqual(conflicts.map(item => [item.key, item.label]), [['settings:tiers', 'Descuentos por cantidad'], ['document:notes', 'Condiciones']]);
  assert.deepEqual(state.settings.tiers, mine.settings.tiers); assert.deepEqual(state.document.notes, mine.document.notes);
  assert.deepEqual(summary.changed, [{ scope: 'settings', name: 'Preparación por pedido' }, { scope: 'document', name: 'Edición' }]);
  assert.deepEqual(errors, []);
});

test('The summary lists what came in from the other computer', () => {
  const mine = clone(seed), theirs = saved(clone(seed), 'Suya');
  material(mine, 'material-1').cost = 3;
  material(theirs, 'material-2').cost = 3; material(theirs, 'material-1').supplier = 'Proveedor B';
  theirs.materials.push(newMaterial('material-x', 'Suyo'));
  const { summary } = mergeCatalogs(seed, mine, theirs);
  assert.deepEqual(summary.added, [{ scope: 'material', name: 'Suyo' }]);
  assert.deepEqual(summary.changed.map(item => item.name).sort(), [material(seed, 'material-1').name, material(seed, 'material-2').name].sort());
});

test('Inputs are never modified and the result is a valid catalog', () => {
  const mine = clone(seed), theirs = saved(clone(seed), 'Suya');
  material(mine, 'material-1').cost = 3; material(theirs, 'material-1').cost = 4; theirs.finishes.pop();
  const copies = [seed, mine, theirs].map(clone);
  const { state, errors } = mergeCatalogs(seed, mine, theirs);
  assert.deepEqual([seed, mine, theirs], copies); assert.deepEqual(errors, []); assert.deepEqual(validate(state), []);
});
