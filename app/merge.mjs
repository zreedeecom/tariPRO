import { clone, basePrice, validate } from './model.mjs';

// Saved-version metadata always follows the incoming version: the merge rebases the draft on it.
const META = new Set(['schemaVersion', 'revision', 'savedAt', 'versionLabel', 'savedWith', 'source']);
const SETS = new Set(['materialIds', 'hiddenRows']);
const LABELS = {
  material: { name: 'Nombre', category: 'Familia', description: 'Descripción', supplier: 'Proveedor', unit: 'Unidad de venta', active: 'Activo', cost: 'Coste', inkCost: 'Tinta / mantenimiento', referenceQty: 'Cantidad de referencia', rolls: 'Bobinas', pricing: 'Precio base', displayName: 'Nombre para cliente', tagline: 'Lema en el PDF' },
  finish: { name: 'Nombre', kind: 'Tipo', label: 'Texto en la tarifa', cost: 'Coste', supplement: 'Suplemento de venta', rolls: 'Bobinas' },
  settings: { inkCost: 'Tinta y mantenimiento', setupCost: 'Preparación por pedido', wasteLength: 'Merma longitudinal', roundStep: 'Redondeo del PVP', tiers: 'Descuentos por cantidad' },
  document: { title: 'Título', subtitle: 'Subtítulo de cabecera', edition: 'Edición', company: 'Empresa', contact: 'Contacto', notes: 'Condiciones', shipping: 'Envío', groups: 'Bloques agrupados' },
};

export function equal(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a).filter(key => a[key] !== undefined), other = Object.keys(b).filter(key => b[key] !== undefined);
  return keys.length === other.length && keys.every(key => equal(a[key], b[key]));
}

const keysOf = (...objects) => [...new Set(objects.flatMap(object => Object.keys(object ?? {})))];
// Added on either side stays; removed on either side goes. Never a conflict.
const mergeSet = (base = [], mine = [], theirs = []) => [...theirs.filter(item => !base.includes(item) || mine.includes(item)), ...mine.filter(item => !base.includes(item) && !theirs.includes(item))];
// The base price as one unit: mode and value, plus the price itself when it is fixed by hand.
const pricingUnit = material => material && { ...material.pricing, ...(material.pricing?.mode === 'fixed' ? { price: material.price } : {}) };

/**
 * Three-way merge of catalogs: `mine` (the draft) and `theirs` (a version saved elsewhere), both from `base`.
 * Returns the merged state based on `theirs`, the conflicts (mine wins unless `choices[key] === 'theirs'`),
 * a summary of what came in from `theirs` and the validation errors of the result.
 */
export function mergeCatalogs(base, mine, theirs, choices = {}) {
  [base, mine, theirs] = [base, mine, theirs].map(clone);
  const conflicts = [], summary = { added: [], removed: [], changed: [] }, merged = new Set();
  // Finishes removed on one side: id -> side whose finish (and per-material supplements) is kept, or null if it goes.
  const follows = new Map();
  // A finish counts as edited when its per-material supplements change too; removing it deletes them.
  const asEdited = (state, scope, item) => scope === 'finish' ? { ...item, overrides: Object.fromEntries(state.materials.flatMap(material => material.supplements?.[item.id] === undefined ? [] : [[material.id, material.supplements[item.id]]])) } : item;
  const finishName = id => (theirs.finishes.find(item => item.id === id) ?? mine.finishes.find(item => item.id === id))?.name ?? id;
  const conflict = (scope, element, field, values) => {
    const key = [scope, element?.id, field].filter(Boolean).join(':');
    const label = field === null ? 'Quitado en un lado y editado en el otro' : field.startsWith('supplements.') ? `Suplemento de ${finishName(field.slice(12))}` : LABELS[scope]?.[field] ?? field;
    conflicts.push({ key, scope, id: element?.id ?? null, name: element?.name ?? LABELS[scope]?.[field] ?? field, field, label, ...values });
    return choices[key] === 'theirs' ? values.theirs : values.mine;
  };
  // One unit: equal sides or a one-sided change wins; otherwise a conflict.
  const pick = (scope, element, field, b, m, t) => equal(m, t) || equal(b, t) ? m : equal(b, m) ? t : conflict(scope, element, field, { base: b, mine: m, theirs: t });

  function mergeFields(scope, element, b = {}, m = {}, t = {}) {
    const out = {};
    const { price: fixedPrice, ...pricing } = scope === 'material' ? pick(scope, element, 'pricing', pricingUnit(b), pricingUnit(m), pricingUnit(t)) ?? {} : {};
    for (const key of keysOf(t, m, b)) {
      let value;
      if (scope === 'material' && key === 'price') value = fixedPrice ?? t.price ?? m.price;
      else if (scope === 'material' && key === 'pricing') value = pricing;
      else if (SETS.has(key)) value = mergeSet(b[key], m[key], t[key]);
      else if (scope === 'material' && key === 'supplements') {
        value = {};
        for (const id of keysOf(t[key], m[key], b[key])) { if (follows.has(id)) continue; const item = pick(scope, element, `supplements.${id}`, b[key]?.[id], m[key]?.[id], t[key]?.[id]); if (item !== undefined) value[id] = item; }
      } else value = pick(scope, element, key, b[key], m[key], t[key]);
      if (value !== undefined) out[key] = value;
      if (element === null && !META.has(key) && !equal(b[key], t[key]) && !equal(m[key], t[key]) && equal(value, t[key])) summary.changed.push({ scope, name: LABELS[scope]?.[key] ?? key });
    }
    return out;
  }

  // Materials and finishes by id, in their order, followed by the ones only mine has.
  function mergeList(scope, b, m, t) {
    const byId = list => new Map(list.map(item => [item.id, item])), bs = byId(b), ms = byId(m), ts = byId(t);
    const result = [];
    for (const { id } of [...t, ...m.filter(item => !ts.has(item.id))]) {
      const bi = bs.get(id), mi = ms.get(id), ti = ts.get(id);
      let value;
      if (mi && ti) {
        if (equal(mi, ti) || equal(bi, ti)) value = mi;
        else if (equal(bi, mi)) value = ti;
        else { value = mergeFields(scope, mi, bi, mi, ti); merged.add(id); }
        if (!equal(bi, ti) && !equal(mi, ti)) summary.changed.push({ scope, name: ti.name });
      } else if (ti) {
        if (!bi) { value = ti; summary.added.push({ scope, name: ti.name }); }
        else { if (!equal(asEdited(base, scope, bi), asEdited(theirs, scope, ti))) value = conflict(scope, ti, null, { base: bi, mine: null, theirs: ti }); follows.set(id, value ? 'theirs' : null); }
      } else if (!bi) value = mi;
      else {
        if (equal(asEdited(base, scope, bi), asEdited(mine, scope, mi))) summary.removed.push({ scope, name: mi.name });
        else value = conflict(scope, mi, null, { base: bi, mine: mi, theirs: null });
        follows.set(id, value ? 'mine' : null);
      }
      if (value) result.push(value);
    }
    return result;
  }

  // Finishes first: materials need to know which removed finishes stay.
  const finishes = mergeList('finish', base.finishes, mine.finishes, theirs.finishes);
  let state = {};
  for (const key of keysOf(theirs, mine, base)) {
    const value = META.has(key) ? theirs[key]
      : key === 'settings' || key === 'document' ? mergeFields(key, null, base[key], mine[key], theirs[key])
      : key === 'finishes' ? finishes
      : key === 'materials' ? mergeList('material', base.materials, mine.materials, theirs.materials)
      : pick('catalog', null, key, base[key], mine[key], theirs[key]);
    if (value !== undefined) state[key] = value;
  }

  // A removed finish that stays brings back its supplements from the side that kept it.
  state = clone(state);
  for (const [id, side] of follows) if (side) for (const material of state.materials) {
    const value = (side === 'mine' ? mine : theirs).materials.find(item => item.id === material.id)?.supplements?.[id];
    if (value === undefined) delete material.supplements[id]; else material.supplements[id] = value;
  }
  // Drop links to finishes or materials that are gone, then price the materials merged field by field.
  const materialIds = new Set(state.materials.map(item => item.id));
  for (const finish of state.finishes) if (finish.materialIds.some(id => !materialIds.has(id))) finish.materialIds = finish.materialIds.filter(id => materialIds.has(id));
  for (const material of state.materials) {
    for (const id of Object.keys(material.supplements ?? {})) if (!state.finishes.some(finish => finish.id === id && finish.materialIds.includes(material.id))) delete material.supplements[id];
  }
  for (const material of state.materials) if (merged.has(material.id)) material.price = basePrice(state, material);
  return { state, conflicts, summary, errors: validate(state) };
}
