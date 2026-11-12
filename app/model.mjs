export const clone = value => structuredClone(value);
export const round = (value, step = 0.01) => Number((Math.round((value + Number.EPSILON * 100) / step) * step).toFixed(8));
export const currency = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
export const number = (value, digits = 2) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: digits }).format(value);
export const unitLabel = material => material.unit === 'm2' ? 'm²' : 'ud.';
export const SCHEMA_VERSION = 2;

export const compatibleFinishes = (state, material) => state.finishes.filter(finish => finish.materialIds.includes(material.id));
export const supplementFor = (material, finish) => material.supplements?.[finish.id] ?? finish.supplement;
export const baseCost = (state, material) => material.cost + (material.inkCost ?? state.settings.inkCost) + state.settings.setupCost / material.referenceQty;

export function basePrice(state, material) {
  const cost = baseCost(state, material), { mode, value } = material.pricing;
  const price = mode === 'margin' ? cost / (1 - value) : mode === 'markup' ? cost * (1 + value) : material.price;
  return round(price, state.settings.roundStep);
}

const rowKey = finishes => finishes.length ? finishes.map(finish => finish.id).sort().join('+') : 'base';
function rowLabel(laminateCount, finishes) {
  const laminate = finishes.find(finish => finish.kind === 'laminate');
  const processes = finishes.filter(finish => finish.kind !== 'laminate').map(finish => finish.label || finish.name.toLocaleLowerCase('es'));
  if (laminateCount) return [laminate ? (laminateCount > 1 ? `Con ${laminate.name}` : 'Con laminado') : 'Sin laminado', ...processes].join(' + ');
  return processes.length ? `Con ${processes.join(' + ')}` : 'Sin acabado';
}

// Every tariff row: no laminate or one compatible laminate, times each process finish on or off.
export function materialRows(state, material) {
  const finishes = compatibleFinishes(state, material);
  const laminates = finishes.filter(finish => finish.kind === 'laminate'), processes = finishes.filter(finish => finish.kind !== 'laminate');
  const masks = Array.from({ length: 2 ** processes.length }, (_, mask) => mask);
  const bits = mask => mask.toString(2).replace(/0/g, '').length;
  const sets = masks.sort((a, b) => bits(a) - bits(b) || a - b).map(mask => processes.filter((_, index) => mask & (1 << index)));
  return [null, ...laminates].flatMap(laminate => sets.map(set => {
    const items = laminate ? [laminate, ...set] : set;
    return { key: rowKey(items), finishes: items, label: rowLabel(laminates.length, items) };
  }));
}

export function priceRows(state, material, { includeHidden = false } = {}) {
  const base = basePrice(state, material), hidden = new Set(material.hiddenRows ?? []);
  return materialRows(state, material).filter(row => includeHidden || !hidden.has(row.key)).map(row => {
    const missing = row.finishes.filter(finish => finish.cost === null).map(finish => finish.name);
    const total = row.finishes.reduce((sum, finish) => sum + (finish.cost ?? 0), baseCost(state, material));
    const price = round(base + row.finishes.reduce((sum, finish) => sum + supplementFor(material, finish), 0), state.settings.roundStep);
    return { ...row, hidden: hidden.has(row.key), price, cost: { total, complete: missing.length === 0, missing },
      margin: missing.length === 0 && price > 0 ? (price - total) / price : null,
      tiers: state.settings.tiers.map(tier => round(price * (1 - tier.rate), 0.01)) };
  });
}

// Supplement that keeps the saved margin of a finish after its cost changed; null when not applicable.
export function suggestedSupplement(saved, finish) {
  const before = saved?.finishes.find(item => item.id === finish.id);
  if (!before || before.cost === null || finish.cost === null || before.cost === finish.cost || before.supplement <= before.cost) return null;
  return round(finish.cost / (before.cost / before.supplement), 0.01);
}

export function materialize(state) {
  const result = clone(state);
  for (const material of result.materials) material.price = basePrice(result, material);
  return result;
}

// Converts v1 catalogs (hand-made variants per material) to v2 (base price + finish supplements).
export function migrate(state) {
  if (state?.schemaVersion !== 1 || !Array.isArray(state.materials) || !Array.isArray(state.finishes)) return state;
  const next = clone(state);
  next.schemaVersion = SCHEMA_VERSION;
  const same = (a, b) => a.length === b.length && a.every(id => b.includes(id));
  const deltas = new Map(next.finishes.map(finish => [finish.id, new Map()]));
  for (const material of next.materials) {
    for (const option of material.options) for (const id of option.finishIds) {
      const without = material.options.find(item => same(item.finishIds, option.finishIds.filter(other => other !== id)));
      if (without && !deltas.get(id)?.has(material.id)) deltas.get(id)?.set(material.id, round(option.price - without.price, 0.0001));
    }
  }
  for (const finish of next.finishes) {
    const found = deltas.get(finish.id);
    const counts = new Map();
    for (const value of found.values()) counts.set(value, (counts.get(value) ?? 0) + 1);
    finish.kind = finish.kind === 'laminate' ? 'laminate' : 'process';
    finish.supplement = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    finish.materialIds = next.materials.filter(material => material.options.some(option => option.finishIds.includes(finish.id))).map(material => material.id);
    const sample = next.materials.flatMap(material => material.options).find(option => option.finishIds.includes(finish.id) && !option.finishIds.some(id => next.finishes.find(item => item.id === id)?.kind === 'laminate'));
    finish.label = finish.kind === 'laminate' ? '' : (sample?.label.includes(' + ') ? sample.label.split(' + ').at(-1) : sample?.label.replace(/^Con /, '')) || finish.name.toLocaleLowerCase('es');
    for (const [materialId, value] of found) if (value !== finish.supplement) {
      const material = next.materials.find(item => item.id === materialId);
      material.supplements = { ...material.supplements, [finish.id]: value };
    }
  }
  for (const material of next.materials) {
    const base = material.options.find(option => option.finishIds.length === 0) ?? material.options[0];
    material.pricing = ['margin', 'markup', 'fixed'].includes(base.pricing.mode) ? { mode: base.pricing.mode, value: base.pricing.value } : { mode: 'fixed', value: 0 };
    material.price = base.price;
    material.supplements ??= {};
    const existing = material.options.map(option => rowKey(option.finishIds.map(id => ({ id }))));
    material.hiddenRows = materialRows(next, material).map(row => row.key).filter(key => !existing.includes(key));
    delete material.options;
  }
  return next;
}

export function discountFor(state, quantity) {
  return [...state.settings.tiers].sort((a, b) => b.minimum - a.minimum).find(item => quantity >= item.minimum)?.rate ?? 0;
}

export function simulate(state, input) {
  const material = state.materials.find(item => item.id === input.materialId);
  if (!material) throw new Error('Selecciona un material.');
  const row = priceRows(state, material, { includeHidden: true }).find(item => item.key === input.rowKey);
  if (!row) throw new Error('Selecciona un acabado.');
  let quantity, consumed, materialRate = material.cost;
  const warnings = [];
  const selectedRoll = material.rolls.find(item => item.id === input.rollId);
  if (material.unit === 'm2') {
    if (!(input.width > 0 && input.length > 0 && Number.isFinite(input.width) && Number.isFinite(input.length))) throw new Error('Introduce ancho y largo válidos y mayores que cero.');
    quantity = input.width * input.length;
    if (material.rolls.length) {
      if (!selectedRoll) throw new Error('Selecciona una bobina.');
      if (input.width > selectedRoll.width) throw new Error('La pieza no cabe en la bobina seleccionada.');
      consumed = selectedRoll.width * (input.length + state.settings.wasteLength);
      materialRate = selectedRoll.cost ?? material.cost;
      for (const finish of row.finishes) {
        if (finish.rolls.length && !finish.rolls.some(item => Math.abs(item.width - selectedRoll.width) < 0.00001)) {
          throw new Error(`No hay bobina de ${finish.name} de ${number(selectedRoll.width)} m. Añádela en Acabados.`);
        }
      }
    } else {
      consumed = quantity;
      warnings.push('Material sin bobinas: consumo igual a superficie facturada; no se estima merma.');
    }
  } else {
    if (!(input.quantity > 0 && Number.isInteger(input.quantity))) throw new Error('Introduce un número entero de unidades mayor que cero.');
    quantity = consumed = input.quantity;
  }
  const materialCost = consumed * materialRate;
  const inkCost = quantity * (material.inkCost ?? state.settings.inkCost);
  const setupCost = state.settings.setupCost;
  const finishes = row.finishes.map(finish => {
    const finishRoll = selectedRoll && finish.rolls.find(item => Math.abs(item.width - selectedRoll.width) < 0.00001);
    const cost = finishRoll?.cost ?? finish.cost;
    if (cost === null) warnings.push(`Falta el coste de ${finish.name}. El resultado es parcial.`);
    return { name: finish.name, total: cost === null ? null : cost * quantity };
  });
  const cost = materialCost + inkCost + setupCost + finishes.reduce((sum, item) => sum + (item.total ?? 0), 0);
  const discount = discountFor(state, quantity);
  const unitPrice = row.price * (1 - discount);
  const income = quantity * unitPrice;
  return { quantity, consumed, waste: consumed ? (consumed - quantity) / consumed : 0, materialCost, inkCost, setupCost, finishes, cost, discount, unitPrice, income, profit: income - cost, margin: income > 0 ? (income - cost) / income : null, complete: finishes.every(item => item.total !== null), warnings };
}

export function validate(state) {
  const errors = [];
  const text = (value, label, maximum = 200) => { if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) errors.push(`${label}: texto obligatorio, hasta ${maximum} caracteres.`); };
  const numeric = (value, label, minimum = 0, maximum = 1000000, nullable = false) => { if (nullable && value === null) return; if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) errors.push(`${label}: usa un número entre ${minimum} y ${maximum}.`); };
  if (!state || state.schemaVersion !== SCHEMA_VERSION || !state.settings || !Array.isArray(state.materials) || !Array.isArray(state.finishes) || !state.document) return ['El archivo no tiene el formato de catálogo esperado.'];
  if (state.materials.length > 200 || state.finishes.length > 200) errors.push('El catálogo admite hasta 200 materiales y 200 acabados.');
  for (const key of ['inkCost', 'setupCost', 'wasteLength']) numeric(state.settings[key], key);
  if (![0.01, 0.05, 0.1, 0.5, 1].includes(state.settings.roundStep)) errors.push('Selecciona un redondeo válido.');
  if (!Array.isArray(state.settings.tiers) || state.settings.tiers.length !== 3) errors.push('Se necesitan tres tramos de descuento.');
  else state.settings.tiers.forEach((tier, index) => {
    numeric(tier.minimum, 'Umbral de descuento', 0.001); numeric(tier.rate, 'Descuento', 0, 0.99);
    if (index && (tier.minimum <= state.settings.tiers[index - 1].minimum || tier.rate < state.settings.tiers[index - 1].rate)) errors.push('Los tramos deben tener cantidades crecientes y descuentos no decrecientes.');
  });
  const identifiers = new Set();
  const id = value => { if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value) || identifiers.has(value)) errors.push('Hay identificadores inválidos o duplicados.'); identifiers.add(value); };
  const rolls = (items, label) => {
    if (!Array.isArray(items) || items.length > 30) { errors.push(`${label}: listado de bobinas inválido.`); return; }
    const widths = new Set();
    for (const roll of items) { id(roll.id); numeric(roll.width, 'Ancho de bobina', 0.01, 10); numeric(roll.cost, 'Coste de bobina', 0, 1000000, true); if (widths.has(roll.width)) errors.push(`${label}: ancho de bobina duplicado.`); widths.add(roll.width); }
  };
  const materialIds = new Set(state.materials.map(item => item.id));
  for (const finish of state.finishes) {
    id(finish.id); text(finish.name, 'Nombre de acabado', 80); numeric(finish.cost, 'Coste de acabado', 0, 1000000, true); numeric(finish.supplement, `${finish.name}: suplemento de venta`);
    if (!['laminate', 'process'].includes(finish.kind)) errors.push('Tipo de acabado inválido.');
    if (typeof finish.label !== 'string' || finish.label.length > 60) errors.push(`${finish.name}: el texto en la tarifa admite hasta 60 caracteres.`);
    if (!Array.isArray(finish.materialIds) || new Set(finish.materialIds).size !== finish.materialIds.length || finish.materialIds.some(item => !materialIds.has(item))) errors.push(`${finish.name}: revisa los materiales compatibles.`);
    rolls(finish.rolls, finish.name);
  }
  for (const material of state.materials) {
    id(material.id); text(material.name, 'Nombre del material', 100); text(material.category, 'Familia', 80);
    if (material.displayName && (typeof material.displayName !== 'string' || material.displayName.length > 130)) errors.push('El nombre público admite hasta 130 caracteres.');
    if (material.tagline && (typeof material.tagline !== 'string' || material.tagline.length > 80)) errors.push('El lema del PDF admite hasta 80 caracteres.');
    if (typeof material.description !== 'string' || material.description.length > 300 || typeof material.supplier !== 'string' || material.supplier.length > 100) errors.push('Descripción o proveedor demasiado largo.');
    if (!['m2', 'unit'].includes(material.unit)) errors.push('Unidad de venta no válida.');
    if (typeof material.active !== 'boolean') errors.push('Estado de material inválido.');
    numeric(material.cost, 'Coste de material'); numeric(material.inkCost, 'Tinta', 0, 1000000, true); numeric(material.referenceQty, 'Cantidad de referencia', 0.001);
    rolls(material.rolls, material.name);
    if (!material.pricing || !['margin', 'markup', 'fixed'].includes(material.pricing.mode)) { errors.push(`${material.name}: forma de cálculo del precio base inválida.`); continue; }
    numeric(material.pricing.value, `${material.name}: objetivo de precio`, 0, material.pricing.mode === 'margin' ? 0.99 : 1000000);
    numeric(material.price, `${material.name}: precio base`);
    const compatible = Array.isArray(state.finishes) ? state.finishes.filter(finish => finish.materialIds?.includes(material.id)) : [];
    if (!material.supplements || typeof material.supplements !== 'object' || Array.isArray(material.supplements)) errors.push(`${material.name}: suplementos inválidos.`);
    else for (const [finishId, value] of Object.entries(material.supplements)) {
      if (!compatible.some(finish => finish.id === finishId)) errors.push(`${material.name}: hay un suplemento de un acabado no compatible.`);
      numeric(value, `${material.name}: suplemento`);
    }
    if (compatible.filter(finish => finish.kind !== 'laminate').length > 4) { errors.push(`${material.name}: máximo cuatro acabados de proceso compatibles.`); continue; }
    if (!Array.isArray(material.hiddenRows) || material.hiddenRows.some(key => typeof key !== 'string')) { errors.push(`${material.name}: filas ocultas inválidas.`); continue; }
    if (material.active && priceRows(state, material).length === 0) errors.push(`${material.name}: deja al menos una fila visible en la tarifa.`);
    const price = basePrice(state, material); if (!Number.isFinite(price) || price < 0 || price > 100000000) errors.push(`${material.name}: precio calculado fuera de rango.`);
  }
  text(state.document.title, 'Título', 100); text(state.document.edition, 'Edición', 60);
  if (state.document.subtitle && (typeof state.document.subtitle !== 'string' || state.document.subtitle.length > 100)) errors.push('El subtítulo admite hasta 100 caracteres.');
  const groups = state.document.groups ?? [];
  if (!Array.isArray(groups) || groups.length > 50) errors.push('Listado de bloques agrupados inválido.');
  else for (const group of groups) {
    text(group?.category, 'Familia agrupada', 80); text(group?.title, 'Título del bloque', 100);
    if (typeof group?.description !== 'string' || group.description.length > 300 || typeof group?.tagline !== 'string' || group.tagline.length > 80) errors.push('Descripción o lema del bloque demasiado largo.');
    if (groups.filter(item => item?.category === group?.category).length > 1) errors.push(`La familia ${group?.category} está agrupada dos veces.`);
    if (new Set(state.materials.filter(item => item.category === group?.category).map(item => item.unit)).size > 1) errors.push(`${group?.category}: para agruparlos, los materiales deben tener la misma unidad de venta.`);
  }
  text(state.document.company, 'Empresa', 160); text(state.document.contact, 'Contacto', 300);
  for (const key of ['notes', 'shipping']) { if (!Array.isArray(state.document[key]) || state.document[key].length > 20) errors.push('Máximo 20 condiciones por bloque.'); else state.document[key].forEach(line => text(line, 'Condición', 500)); }
  return [...new Set(errors)];
}
