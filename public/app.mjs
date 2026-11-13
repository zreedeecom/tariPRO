import { clone, currency, number, round, unitLabel, priceRows, basePrice, baseCost, compatibleFinishes, suggestedSupplement, simulate, validate, materialize, migrate } from '/model.mjs';
import { mergeCatalogs } from '/merge.mjs';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icons = {
 table:'M3 4h18v16H3z M3 9h18 M9 9v11', layers:'m3 7 9-4 9 4-9 4z M3 12l9 4 9-4 M3 17l9 4 9-4',
 sliders:'M4 7h16 M4 17h16 M8 4v6 M16 14v6', ruler:'m4 15 11-11 5 5L9 20z M10 9l2 2 M14 5l2 2 M6 13l2 2',
 file:'M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8 M8 17h6', history:'M3 10a9 9 0 1 1 2 8 M3 4v6h6 M12 7v6l4 2',
 eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
 download:'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5', search:'M10 3a7 7 0 1 0 0 14 7 7 0 1 0 0-14 M15 15l6 6',
 plus:'M12 4v16 M4 12h16', close:'m6 6 12 12 M6 18 18 6', alert:'m12 3 10 18H2z M12 9v5 M12 17v1', arrow:'M5 12h14 m-5-5 5 5-5 5', copy:'M8 8h12v13H8z M4 16H3V3h13v1'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name] || icons.file}"/></svg>`;
function hydrateIcons() { document.querySelectorAll('[data-icon]').forEach(item => { item.innerHTML = icon(item.dataset.icon); }); }
hydrateIcons();
let saved, draft, view = 'tariff', selectedId, search = '', family = '', showArchived = false, busy = false, previewUrl, exportAfterSave = false;
let recoveredDraft = null;
const invalidFields = new Set();
let simulationInput = { materialId: 'material-4', rowKey: 'base', width: 1, length: 1, quantity: 1, rollId: 'roll-4' };
const storageKey = 'impress-tariff-draft-v2', legacyStorageKey = 'impress-tariff-draft-v1';
const uid = prefix => `${prefix}-${crypto.randomUUID().slice(0, 10)}`;
const isDirty = () => JSON.stringify(draft) !== JSON.stringify(saved);
function error(message) { $('#error-banner').textContent = message; $('#error-banner').hidden = !message; }
function toast(message, duration = 5000) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { $('#toast').hidden = true; }, duration); }
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  if (!response.ok) { const payload = await response.json().catch(() => ({})); throw Object.assign(new Error(payload.error || `No se pudo completar la operación (${response.status}).`), { code: payload.code }); }
  return response.headers.get('Content-Type')?.includes('application/pdf') ? response.blob() : response.json();
}
function persistDraft() {
  try { localStorage.removeItem(legacyStorageKey); if (isDirty()) localStorage.setItem(storageKey, JSON.stringify({ baseRevision: saved.revision, state: draft })); else localStorage.removeItem(storageKey); }
  catch { error('El navegador no permite recuperar el borrador tras cerrar. Guarda una versión o exporta el JSON antes de salir.'); }
}
function changed() { error(''); persistDraft(); updateStatus(); refreshComputed(); }
function updateStatus() {
  const dirty = isDirty() || invalidFields.size > 0; $('#save-status').textContent = invalidFields.size ? 'Borrador · corrige los campos señalados' : dirty ? 'Borrador · cambios sin guardar' : `Guardado · ${saved.versionLabel}`;
  $('#status-dot').classList.toggle('dirty', dirty); $('#save-button').disabled = !dirty || busy;
  document.querySelectorAll('.draft-strip').forEach(item => { item.hidden = !dirty; });
  if ($('#change-count')) $('#change-count').textContent = priceChanges();
}
function priceChanges() {
  let count = 0;
  for (const material of draft.materials) {
    const before = savedRows(material);
    try { for (const row of priceRows(draft, material)) { const old = before.find(item => item.key === row.key); if (old && Math.abs(row.price - old.price) > .0001) count++; } }
    catch { return 'Hay datos que revisar'; }
  }
  return `${count} ${count === 1 ? 'precio cambia' : 'precios cambian'}`;
}
const heading = (title, description, action = '') => `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ''}</div>`;
const draftStrip = () => `<div class="draft-strip" ${isDirty() ? '' : 'hidden'}><span><strong>Estás probando cambios.</strong> <span id="change-count">${priceChanges()}</span>. La tarifa guardada sigue intacta.</span><button class="text-button" data-action="discard">Descartar borrador</button></div>`;
const optionTag = (value, label, selected) => `<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(label)}</option>`;
function field(label, path, value, config = {}) {
  const { numeric = false, nullable = false, percent = false, min = 0, max = 1000000, step = 'any', hint = '', wide = false, placeholder = '', maxLength = 200, optional = false } = config;
  return `<label class="${wide ? 'wide' : ''}">${label}<input data-bind="${path}" ${numeric ? `type="number" min="${min}" max="${max}" step="${step}" data-number="true" ${nullable ? 'data-nullable="true"' : 'required'} ${percent ? 'data-percent="true"' : ''}` : `type="text" maxlength="${maxLength}" ${optional ? '' : 'required'}`} value="${escape(value === null ? '' : percent ? Number((value * 100).toFixed(2)) : value)}" placeholder="${escape(placeholder)}">${hint ? `<small>${hint}</small>` : ''}</label>`;
}
const selectField = (label, path, values, current) => `<label>${label}<select data-bind="${path}">${values.map(([value, title]) => optionTag(value, title, current)).join('')}</select></label>`;
function delta(newPrice, oldPrice) { if (oldPrice === undefined || Math.abs(newPrice - oldPrice) < .0001) return ''; const diff = newPrice - oldPrice; return `<span class="delta ${diff > 0 ? 'increase' : 'decrease'}">${diff > 0 ? '+' : ''}${currency(diff)}</span>`; }
function safeRows(material, options) { try { return priceRows(draft, material, options); } catch { return []; } }
const savedMaterial = material => saved.materials.find(item => item.id === material.id);
function savedRows(material) { const original = savedMaterial(material); try { return original ? priceRows(saved, original, { includeHidden: true }) : []; } catch { return []; } }
function safeBase(state, material) { try { return material ? basePrice(state, material) : undefined; } catch { return undefined; } }
function renderCatalogTable() {
  const filtered = draft.materials.filter(material => (showArchived || material.active) && (!family || material.category === family) && `${material.name} ${material.category} ${material.description}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  const body = filtered.map(material => {
    const current = safeBase(draft, material);
    const previous = safeBase(saved, savedMaterial(material));
    return `<tr class="${selectedId === material.id ? 'selected' : ''}" data-select="${material.id}"><td><button class="product-link" data-select="${material.id}">${escape(material.name)}${!material.active ? ' <span class="badge">Archivado</span>' : ''}<span class="product-family">${escape(material.category)}</span></button></td><td class="numeric">${number(material.cost, 4)} €<span class="product-family">/${unitLabel(material)}</span></td><td class="numeric">${previous === undefined ? '—' : currency(previous)}</td><td class="numeric"><strong>${current === undefined ? '—' : currency(current)}</strong>${current === undefined ? '' : delta(current, previous)}</td></tr>`;
  }).join('');
  return `<div class="catalog-table-wrap"><table class="catalog-table"><thead><tr><th>Material</th><th class="numeric">Coste</th><th class="numeric">Guardado</th><th class="numeric">Propuesto</th></tr></thead><tbody>${body || '<tr><td colspan="4"><div class="empty-state">No hay materiales con estos filtros.</div></td></tr>'}</tbody></table><div class="table-caption">Precio base sin acabados · PVP sin IVA por unidad de venta</div></div><p class="count-note">${filtered.length} materiales · ${draft.materials.reduce((count, item) => count + safeRows(item).length, 0)} filas en la tarifa</p>`;
}
function marginCell(row) { return row.margin === null ? `<span class="hint">Falta coste de ${escape(row.cost.missing.join(', ')) || 'acabado'}</span>` : `${number(row.margin * 100, 1)} %`; }
function comparison(material) {
  const index = draft.materials.indexOf(material), before = savedRows(material), rows = safeRows(material, { includeHidden: true });
  if (!rows.length) return '<div class="warning">Revisa los datos del material para calcular los precios.</div>';
  return `<table class="price-comparison"><thead><tr><th>Fila de la tarifa</th><th>Guardado</th><th>Propuesto</th><th>Margen</th><th>En PDF</th></tr></thead><tbody>${rows.map(row => {
    const old = before.find(item => item.key === row.key)?.price;
    return `<tr class="${row.hidden ? 'row-hidden' : ''}"><td>${escape(row.label)}</td><td class="old-price">${old === undefined ? 'Nueva' : currency(old)}</td><td><strong>${currency(row.price)}</strong>${delta(row.price, old)}</td><td>${marginCell(row)}</td><td><input type="checkbox" data-row-toggle="${index}" value="${escape(row.key)}" ${row.hidden ? '' : 'checked'} aria-label="Mostrar ${escape(row.label)} en la tarifa"></td></tr>`;
  }).join('')}</tbody></table>${rows.some(row => !row.cost.complete) ? `<div class="warning">${icon('alert')}<span>Faltan costes de ${escape([...new Set(rows.flatMap(row => row.cost.missing))].join(', '))}. El precio está definido; el margen se calculará cuando completes ese coste en Acabados.</span></div>` : ''}`;
}
function rollEditor(owner, path) {
  return `${owner.rolls.map((roll, index) => `<div class="roll-row">${field('Ancho (m)', `${path}.rolls.${index}.width`, roll.width, { numeric: true, min: .01, max: 10 })}${field('Coste específico', `${path}.rolls.${index}.cost`, roll.cost, { numeric: true, nullable: true, placeholder: 'Usar coste general' })}<button class="icon-button" data-action="remove-roll" data-path="${path}" data-index="${index}" aria-label="Eliminar bobina de ${number(roll.width)} m">${icon('close')}</button></div>`).join('')}<button class="button small" data-action="add-roll" data-path="${path}">${icon('plus')}Añadir bobina</button>`;
}
function baseSummary(material) { try { return `Coste de referencia ${currency(baseCost(draft, material))} → precio base ${currency(basePrice(draft, material))} por ${unitLabel(material)}.`; } catch { return ''; } }
function basePriceEditor(material, path) {
  const mode = material.pricing.mode, unit = unitLabel(material);
  const value = mode === 'fixed' ? field(`Precio base (€/${unit})`, `${path}.price`, material.price, { numeric: true }) : field(mode === 'margin' ? 'Margen objetivo (%)' : 'Recargo sobre coste (%)', `${path}.pricing.value`, material.pricing.value, { numeric: true, percent: true, max: mode === 'margin' ? 99 : 1000000 });
  return `<div class="section-title"><h3>Precio base · sin acabados</h3></div><div class="field-grid">${selectField('Cómo se calcula', `${path}.pricing.mode`, [['margin', 'Margen sobre venta'], ['markup', 'Recargo sobre coste'], ['fixed', 'Precio fijo']], mode)}${value}</div><p class="helper" id="base-summary">${baseSummary(material)}</p>`;
}
function supplementEditor(material) {
  const index = draft.materials.indexOf(material), finishes = compatibleFinishes(draft, material);
  if (!finishes.length) return '<p class="helper">Este material no tiene acabados compatibles. Asígnalos en <button class="text-button" data-view="finishes">Acabados</button>.</p>';
  return `<div class="supplement-list">${finishes.map(finish => `<label>${escape(finish.name)}<input type="number" min="0" step="any" data-supplement="${index}" data-finish="${finish.id}" value="${material.supplements[finish.id] ?? ''}" placeholder="Por defecto: ${number(finish.supplement)} €/${unitLabel(material)}"><small>${finish.kind === 'laminate' ? 'Laminado' : 'Proceso'}</small></label>`).join('')}</div><p class="helper">Suplemento de venta en €/${unitLabel(material)} que se suma al precio base. Vacío usa el del acabado. Qué acabados admite cada material se decide en <button class="text-button" data-view="finishes">Acabados</button>.</p>`;
}
function materialEditor() {
  const index = draft.materials.findIndex(item => item.id === selectedId);
  const material = draft.materials[index];
  if (!material) return '<div class="sheet empty-state"><h2>Selecciona un material</h2><p>Abre una referencia para ajustar costes, precios y acabados.</p></div>';
  const path = `materials.${index}`;
  return `<section class="detail-panel" aria-label="Editor del material"><div class="detail-head"><h2>${escape(material.name)}</h2><p>Edita el coste y el precio base; los acabados suman su suplemento.</p></div><div class="detail-body"><div class="field-grid">${field(`Coste de compra (€/${unitLabel(material)})`, `${path}.cost`, material.cost, { numeric: true, hint: 'Coste neto. Conserva hasta 4 decimales.' })}${field('Tinta / mantenimiento', `${path}.inkCost`, material.inkCost, { numeric: true, nullable: true, placeholder: `General: ${number(draft.settings.inkCost)} €`, hint: `Por ${unitLabel(material)}. Vacío usa el coste general.` })}</div><div class="cost-adjust"><span>Probar subida:</span><button class="button small" data-action="bump-cost" data-rate="0.05">+5 %</button><button class="button small" data-action="bump-cost" data-rate="0.10">+10 %</button></div>${basePriceEditor(material, path)}<div class="section-title"><h3>Así quedaría la tarifa</h3><span class="hint">€/${unitLabel(material)} · sin IVA</span></div><div id="price-comparison">${comparison(material)}</div><p class="helper">Las filas salen de los acabados compatibles. Desmarca «En PDF» para ocultar una. Margen de referencia para ${number(material.referenceQty)} ${unitLabel(material)}, sin merma ni descuento.</p><details class="accordion" open><summary>Suplementos de acabados (${compatibleFinishes(draft, material).length})</summary>${supplementEditor(material)}</details><details class="accordion"><summary>Datos del material y unidad de venta</summary><div class="field-grid">${field('Nombre', `${path}.name`, material.name, { wide: true, maxLength: 100 })}${field('Nombre para cliente (opcional)', `${path}.displayName`, material.displayName || '', { wide: true, maxLength: 130, optional: true, hint: 'Vacío utiliza el nombre del material.' })}${field('Familia', `${path}.category`, material.category, { maxLength: 80 })}${field('Lema en el PDF (opcional)', `${path}.tagline`, material.tagline || '', { maxLength: 80, optional: true, hint: 'Aparece a la derecha de la barra de familia.' })}${selectField('Unidad de venta', `${path}.unit`, [['m2', 'Metro cuadrado (m²)'], ['unit', 'Unidad (ud.)']], material.unit)}${field('Proveedor', `${path}.supplier`, material.supplier, { maxLength: 100, optional: true })}${field('Cantidad de referencia', `${path}.referenceQty`, material.referenceQty, { numeric: true, min: .001, hint: 'Reparte la preparación entre estas unidades.' })}<label class="wide">Descripción<textarea data-bind="${path}.description" maxlength="300">${escape(material.description)}</textarea></label></div></details><details class="accordion"><summary>Anchos de bobina (${material.rolls.map(roll => `${number(roll.width)} m`).join(' · ') || 'ninguno'})</summary><p class="helper">Añade cada ancho que tengas de este material (p. ej. 1,00 · 1,37 · 1,52 m). El precio de la tarifa no depende del ancho: el simulador lo usa para calcular consumo y merma. Un coste específico sustituye al coste general solo en el simulador. Si el material lleva laminado, añade también ese ancho al laminado en Acabados.</p>${rollEditor(material, path)}</details><details class="accordion"><summary>Todos los tramos de la tarifa</summary><div id="tier-preview">${tierPreview(material)}</div></details><div class="detail-footer"><button class="text-button" data-action="duplicate-material">${icon('copy')} Duplicar material</button><button class="text-button danger-text" data-action="archive-material">${material.active ? 'Archivar' : 'Reactivar'}</button></div></div></section>`;
}
function tierPreview(material) { return `<div class="table-scroll"><table class="tier-table"><thead><tr><th>Acabado</th><th>Base</th>${draft.settings.tiers.map(tier => `<th>≥ ${number(tier.minimum)} ${unitLabel(material)}</th>`).join('')}</tr></thead><tbody>${safeRows(material).map(row => `<tr><td>${escape(row.label)}</td>${[row.price, ...row.tiers].map(price => `<td>${currency(price)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
function renderTariff() {
  return heading('Tu tarifa, bajo control.', 'Actualiza costes, decide la rentabilidad y revisa los precios antes de guardar.', `<button class="button" data-action="new-material">${icon('plus')}Nuevo material</button>`) + draftStrip() + `<div class="catalog-toolbar"><label class="search">${icon('search')}<input id="material-search" type="search" placeholder="Buscar material o familia…" aria-label="Buscar material" value="${escape(search)}"></label><select id="family-filter" aria-label="Filtrar por familia">${optionTag('', 'Todas las familias', family)}${[...new Set(draft.materials.map(item => item.category))].sort().map(name => optionTag(name, name, family)).join('')}</select><label class="check-inline"><input type="checkbox" id="show-archived" ${showArchived ? 'checked' : ''}>Ver archivados</label></div><div class="catalog-layout"><section id="catalog-list" aria-label="Catálogo de materiales">${renderCatalogTable()}</section><div id="material-editor">${materialEditor()}</div></div>`;
}
function finishMarginNote(finish) {
  const suggestion = suggestedSupplement(saved, finish);
  const margin = finish.cost === null ? 'Sin coste: margen pendiente.' : finish.supplement > 0 ? `Margen del suplemento: ${number((finish.supplement - finish.cost) / finish.supplement * 100, 1)} %.` : 'Sin suplemento de venta.';
  return `<span class="hint">${margin}</span>${suggestion === null || Math.abs(suggestion - finish.supplement) < .005 ? '' : `<span class="suggestion">El coste ha cambiado. Para mantener el margen guardado: ${currency(suggestion)}</span><button class="button small" data-action="apply-suggestion" data-id="${finish.id}" data-value="${suggestion}">Aplicar</button>`}`;
}
function finishUnit(finish) { const units = [...new Set(draft.materials.filter(item => finish.materialIds.includes(item.id)).map(unitLabel))]; return units.length ? units.map(unit => `€/${unit}`).join(' / ') : '€/m²'; }
function renderFinishes() {
  return heading('Acabados', 'Cada acabado suma su suplemento al precio base de los materiales compatibles y genera sus filas en la tarifa.', `<button class="button" data-action="new-finish">${icon('plus')}Nuevo acabado</button>`) + draftStrip() + `<section class="sheet"><p class="list-summary">Coste y suplemento se expresan por unidad de venta del material (€/m² o €/ud.). Los laminados son excluyentes: una fila lleva como máximo uno.</p><div class="finish-list">${draft.finishes.map((finish, index) => `<div class="finish-card"><div class="finish-card-head"><h3>${escape(finish.name)}</h3><button class="button small quiet" data-action="remove-finish" data-id="${finish.id}">Eliminar</button></div><div class="field-grid">${field('Nombre', `finishes.${index}.name`, finish.name, { maxLength: 80 })}${selectField('Tipo', `finishes.${index}.kind`, [['laminate', 'Laminado'], ['process', 'Proceso (troquelado, ollados…)']], finish.kind)}${field(`Coste (${finishUnit(finish)})`, `finishes.${index}.cost`, finish.cost, { numeric: true, nullable: true, placeholder: 'Pendiente', hint: 'Vacío si aún no lo conoces.' })}${field(`Suplemento de venta (${finishUnit(finish)})`, `finishes.${index}.supplement`, finish.supplement, { numeric: true, hint: 'Se suma al precio base. Cada material puede cambiarlo.' })}${finish.kind === 'laminate' ? '' : field('Texto en la tarifa', `finishes.${index}.label`, finish.label, { maxLength: 60, optional: true, placeholder: finish.name.toLocaleLowerCase('es'), hint: 'Ej.: «troquelado» → «Sin laminado + troquelado».' })}</div><p class="finish-margin" data-finish-margin="${index}">${finishMarginNote(finish)}</p><details class="accordion" ${finish.materialIds.length ? '' : 'open'}><summary>Materiales compatibles (${finish.materialIds.length})</summary><div class="finish-checks">${draft.materials.map(material => `<label><input type="checkbox" data-finish-material="${index}" value="${material.id}" ${finish.materialIds.includes(material.id) ? 'checked' : ''}>${escape(material.name)}</label>`).join('') || '<span class="hint">Aún no hay materiales.</span>'}</div></details>${finish.kind === 'laminate' ? `<details class="accordion"><summary>Anchos de bobina (${finish.rolls.map(roll => `${number(roll.width)} m`).join(' · ') || 'sin restricción'})</summary><p class="helper">El simulador exige que el laminado tenga el mismo ancho que la bobina del material. Sin anchos, no se comprueba.</p>${rollEditor(finish, `finishes.${index}`)}</details>` : ''}</div>`).join('') || '<div class="empty-state">Añade el primer acabado para asociarlo a un material.</div>'}</div></section>`;
}
function renderSettings() {
  return heading('Costes y descuentos', 'Parámetros comunes de producción y reglas comerciales de la tarifa.') + draftStrip() + `<div class="two-column"><section class="sheet"><h2>Producción</h2><div class="field-grid">${field('Tinta y mantenimiento (€)', 'settings.inkCost', draft.settings.inkCost, { numeric: true, hint: 'Por unidad de venta. Puede cambiarse en cada material.' })}${field('Preparación por pedido (€)', 'settings.setupCost', draft.settings.setupCost, { numeric: true, hint: 'Se aplica una sola vez por trabajo.' })}${field('Merma longitudinal (m)', 'settings.wasteLength', draft.settings.wasteLength, { numeric: true, hint: 'Inicio + fin de una tirada en bobina.' })}${selectField('Redondeo del PVP', 'settings.roundStep', [[.01, 'Al céntimo'], [.05, 'A 0,05 €'], [.1, 'A 0,10 €'], [.5, 'A 0,50 €'], [1, 'Al euro']], draft.settings.roundStep)}</div><p class="helper">Redondeo al valor más cercano. Los costes conservan su precisión; los precios con descuento se muestran a dos decimales.</p><div class="form-section"><h3>Cómo se calcula la referencia</h3><p class="helper">Coste del material + tinta + preparación ÷ cantidad de referencia. Cada acabado suma su suplemento al precio y su coste al margen. Esta referencia no incluye merma. Usa el simulador para comprobar la rentabilidad de una medida concreta.</p><p class="helper">Un margen del 40 % calcula coste ÷ 0,60. Un recargo del 40 % calcula coste × 1,40: producen precios diferentes.</p></div></section><section class="sheet"><h2>Descuentos por cantidad</h2><table class="setting-table"><thead><tr><th>Desde m² / unidades</th><th>Descuento (%)</th></tr></thead><tbody>${draft.settings.tiers.map((tier, index) => `<tr><td>${field(`Tramo ${index + 1}`, `settings.tiers.${index}.minimum`, tier.minimum, { numeric: true, min: .001 })}</td><td>${field('Descuento', `settings.tiers.${index}.rate`, tier.rate, { numeric: true, percent: true, max: 99 })}</td></tr>`).join('')}</tbody></table><p class="helper">Los descuentos se aplican al precio completo de cada fila, suplementos incluidos. El simulador evalúa un trabajo; no agrupa pedidos.</p><div class="form-section"><h3>Ajustar todos los precios base</h3><p class="helper">Aplica un margen objetivo al precio base de todos los materiales. Los suplementos de acabados no cambian.</p><div class="batch-controls"><label>Margen sobre venta (%)<input id="batch-margin" type="number" min="0" max="99" value="45" step="any"></label><button class="button" data-action="batch-margin">Probar en borrador</button></div></div></section></div>`;
}
function renderSimulator() {
  let material = draft.materials.find(item => item.id === simulationInput.materialId) || draft.materials[0];
  if (!material) return heading('Simulador de trabajos', 'Añade un material para simular su producción.');
  simulationInput.materialId = material.id;
  const rows = safeRows(material, { includeHidden: true });
  if (!rows.some(item => item.key === simulationInput.rowKey)) simulationInput.rowKey = rows[0]?.key ?? 'base';
  if (!material.rolls.some(item => item.id === simulationInput.rollId)) simulationInput.rollId = material.rolls[0]?.id ?? '';
  return heading('¿Qué deja este trabajo?', 'Comprueba consumo, merma y rentabilidad con los precios del borrador.') + `<div class="two-column"><section class="sheet"><h2>Configura el trabajo</h2><div class="field-grid"><label class="wide">Material<select data-sim="materialId">${draft.materials.map(item => optionTag(item.id, item.name, material.id)).join('')}</select></label><label class="wide">Acabado<select data-sim="rowKey">${rows.map(row => optionTag(row.key, `${row.label}${row.hidden ? ' · oculta en la tarifa' : ''}`, simulationInput.rowKey)).join('')}</select></label>${material.unit === 'm2' ? `<label>Ancho de pieza (m)<input data-sim="width" type="number" value="${simulationInput.width}" min=".001" step="any" required></label><label>Largo de pieza (m)<input data-sim="length" type="number" value="${simulationInput.length}" min=".001" step="any" required></label>${material.rolls.length ? `<label class="wide">Bobina<select data-sim="rollId">${material.rolls.map(item => optionTag(item.id, `${number(item.width)} m${item.cost === null ? '' : ' · ' + number(item.cost, 4) + ' €/m²'}`, simulationInput.rollId)).join('')}</select></label>` : ''}` : `<label>Cantidad (ud.)<input data-sim="quantity" type="number" value="${simulationInput.quantity}" min="1" step="1" required></label>`}</div><p class="helper">Una pieza y una tirada. Sin giro automático ni aprovechamiento lateral. Los costes de tinta y acabados se imputan a la cantidad facturada.</p><div class="warning">${icon('alert')}<span>Estimación de producción. No incluye gastos de estructura, envío ni trabajos adicionales no registrados.</span></div></section><section class="sheet sim-result" id="simulation-result" aria-live="polite">${simulationResult()}</section></div>`;
}
function simulationResult() {
  try {
    const result = simulate(draft, simulationInput);
    const material = draft.materials.find(item => item.id === simulationInput.materialId);
    const line = (label, value, extra = '') => `<div class="result-line ${extra}"><span>${label}</span><strong>${value}</strong></div>`;
    return `<h2>Resultado estimado</h2>${line(`Cantidad facturada (${unitLabel(material)})`, number(result.quantity, 3))}${line(`Consumo (${unitLabel(material)})`, number(result.consumed, 4))}<div class="consumption-bar" role="img" aria-label="Merma ${number(result.waste * 100, 1)} por ciento"><progress max="100" value="${Math.max(0, (1 - result.waste) * 100)}" aria-label="Aprovechamiento"></progress></div><div class="consumption-legend"><span>Aprovechamiento ${number((1 - result.waste) * 100, 1)} %</span><span>Merma ${number(result.waste * 100, 1)} %</span></div><p class="result-section">Desglose de costes</p>${line('Material consumido', currency(result.materialCost))}${line('Tinta y mantenimiento', currency(result.inkCost))}${line('Preparación · una vez', currency(result.setupCost))}${result.finishes.map(finish => line(escape(finish.name), finish.total === null ? 'Pendiente' : currency(finish.total))).join('')}${line(result.complete ? 'Coste total' : 'Coste conocido (parcial)', currency(result.cost), 'total')}<p class="result-section">Venta con descuento de ${number(result.discount * 100)} %</p>${line('Precio por unidad', currency(result.unitPrice))}${line('Ingreso sin IVA', currency(result.income))}${line(result.complete ? 'Resultado estimado' : 'Resultado antes de costes pendientes', currency(result.profit), `profit ${result.profit < 0 ? 'negative' : ''}`)}<p class="hint">${result.margin === null ? 'Sin margen porcentual con venta a cero.' : `Margen ${result.complete ? '' : 'parcial '}${number(result.margin * 100, 2)} % sobre venta.`}</p>${result.warnings.map(message => `<div class="warning">${escape(message)}</div>`).join('')}`;
  } catch (exception) { return `<h2>Revisa el trabajo</h2><div class="warning">${icon('alert')}<span>${escape(exception.message)}</span></div>`; }
}
function groupEditor() {
  const groups = draft.document.groups ?? [];
  const categories = [...new Set([...draft.materials.map(item => item.category), ...groups.map(item => item.category)])];
  return `<div class="form-section"><h3>Familias en un solo bloque</h3><p class="helper">Agrupa los materiales de una familia en una única tabla del PDF. Cada fila muestra material y acabado.</p>${categories.map(category => {
    const index = groups.findIndex(item => item.category === category);
    const fields = index < 0 ? '' : `<div class="field-grid">${field('Título del bloque', `document.groups.${index}.title`, groups[index].title, { maxLength: 100 })}${field('Lema', `document.groups.${index}.tagline`, groups[index].tagline, { maxLength: 80, optional: true })}${field('Descripción', `document.groups.${index}.description`, groups[index].description, { wide: true, maxLength: 300, optional: true })}</div>`;
    return `<label class="check-inline"><input type="checkbox" data-group-toggle value="${escape(category)}" ${index < 0 ? '' : 'checked'}>${escape(category)}</label>${fields}`;
  }).join('')}</div>`;
}
function renderDocument() {
  return heading('Una tarifa lista para entregar', 'Contenido público y vista previa del PDF. Los costes internos nunca se incluyen.') + draftStrip() + `<div class="two-column"><section class="sheet"><h2>Contenido del documento</h2><div class="field-grid">${field('Título', 'document.title', draft.document.title, { wide: true, maxLength: 100 })}${field('Subtítulo de cabecera', 'document.subtitle', draft.document.subtitle || '', { wide: true, maxLength: 100, optional: true, hint: 'Vacío muestra la edición.' })}${field('Edición', 'document.edition', draft.document.edition, { wide: true, maxLength: 60, hint: 'Aparece en el pie de cada página.' })}${field('Empresa', 'document.company', draft.document.company, { wide: true, maxLength: 160 })}<label class="wide">Contacto<textarea data-bind="document.contact" maxlength="300">${escape(draft.document.contact)}</textarea></label><label class="wide">Observaciones · una por línea<textarea rows="8" data-lines="notes">${escape(draft.document.notes.join('\n'))}</textarea></label><label class="wide">Gastos de envío · una condición por línea<textarea rows="5" data-lines="shipping">${escape(draft.document.shipping.join('\n'))}</textarea></label></div><p class="helper">Las condiciones son texto comercial. Editarlas no añade suplementos al simulador: los costes y precios se configuran en materiales y acabados.</p>${groupEditor()}</section><section class="sheet"><div class="doc-preview-cover"><img src="/assets/impress-logo.jpg" alt="Impress"><h2>${escape(draft.document.title)}</h2><p>${escape(draft.document.edition)}</p><div class="orange-rule"></div></div><div class="paper-detail"><div><span>Formato de impresión</span><strong>A4 · 210 × 297 mm</strong></div><div><span>Materiales incluidos</span><strong>${draft.materials.filter(item => item.active).length}</strong></div><div><span>Precios</span><strong>Sin IVA</strong></div><div><span>Contenido</span><strong>Texto y tablas vectoriales</strong></div></div><button class="button" data-action="preview">${icon('eye')}Ver PDF completo</button><p class="helper">La vista previa admite el borrador. Al generar, se guarda el PDF de una versión confirmada en la carpeta exports/, sin reemplazar las anteriores.</p><div id="export-result"></div></section></div>`;
}
async function renderHistory() {
  const content = heading('Cada versión, a salvo', 'Recupera una edición como borrador o genera su PDF con la plantilla actual.') + `<section class="sheet"><div class="import-area"><button class="button" data-action="backup">${icon('download')}Exportar catálogo JSON</button><button class="button" data-action="import">Importar catálogo JSON</button></div><p class="helper">El JSON incluye materiales, costes, acabados y contenido. Importar prepara un borrador; no reemplaza la versión guardada.</p></section><section class="sheet" id="history-list"><div class="loading-state">Leyendo versiones…</div></section>`;
  $('#main').innerHTML = content;
  try {
    const items = await api('/api/history');
    if (view !== 'history') return;
    $('#history-list').innerHTML = `<h2>Historial de tarifas</h2>${items.map(item => { const date = item.date ? new Date(item.date).toLocaleString('es-ES') : 'Versión inicial'; return `<div class="history-item"><div><h3>${escape(item.label)}${item.id === saved.revision ? '<span class="badge">Vigente</span>' : ''}</h3><p>${date} · ${item.materials} materiales</p></div><div class="history-actions"><button class="button small" data-action="restore-version" data-id="${item.id}">Recuperar borrador</button><button class="button small" data-action="export-version" data-id="${item.id}">${icon('download')}PDF</button>${item.id === saved.revision ? '' : `<button class="button small danger-text" data-action="delete-version" data-id="${item.id}" data-label="${escape(item.label)}" data-date="${escape(date)}">Borrar</button>`}</div></div>`; }).join('')}`;
  } catch (exception) { error(exception.message); }
}
function render() {
  document.querySelectorAll('[data-view]').forEach(button => { button.classList.toggle('active', button.dataset.view === view); button.setAttribute('aria-current', button.dataset.view === view ? 'page' : 'false'); });
  if (view === 'history') renderHistory();
  else $('#main').innerHTML = ({ tariff: renderTariff, finishes: renderFinishes, settings: renderSettings, simulator: renderSimulator, document: renderDocument }[view] || renderTariff)();
  updateStatus();
}
function refreshComputed() {
  if (view === 'tariff') {
    const material = draft.materials.find(item => item.id === selectedId);
    if ($('#catalog-list')) $('#catalog-list').innerHTML = renderCatalogTable();
    if (material && $('#price-comparison')) $('#price-comparison').innerHTML = comparison(material);
    if (material && $('#tier-preview')) $('#tier-preview').innerHTML = tierPreview(material);
    if (material && $('#base-summary')) $('#base-summary').textContent = baseSummary(material);
  }
  if (view === 'finishes') document.querySelectorAll('[data-finish-margin]').forEach(item => { item.innerHTML = finishMarginNote(draft.finishes[Number(item.dataset.finishMargin)]); });
  if (view === 'simulator' && $('#simulation-result')) $('#simulation-result').innerHTML = simulationResult();
}
function getPath(path) { return path.split('.').reduce((item, key) => item[key], draft); }
function setPath(path, value) { const keys = path.split('.'); const last = keys.pop(); keys.reduce((item, key) => item[key], draft)[last] = value; }
function handleBinding(target) {
  const path = target.dataset.bind;
  if (target.tagName === 'SELECT' && invalidFields.size) { target.value = getPath(path); error('Corrige el campo numérico señalado antes de cambiar de configuración.'); return; }
  let value = target.value;
  if (target.dataset.number || path === 'settings.roundStep') {
    if (target.value === '' && target.dataset.nullable) value = null;
    else { value = Number(target.value); if (target.value === '' || !target.checkValidity() || !Number.isFinite(value)) { error('Revisa el campo numérico: falta un valor o está fuera del rango permitido.'); target.setAttribute('aria-invalid', 'true'); invalidFields.add(path); updateStatus(); return; } }
    if (value !== null && target.dataset.percent) value /= 100;
  }
  target.removeAttribute('aria-invalid');
  invalidFields.delete(path);
  if (path.endsWith('.pricing.mode')) {
    // Switching mode keeps today's base price and derives the equivalent target.
    const material = draft.materials[Number(path.split('.')[1])];
    const cost = baseCost(draft, material), current = basePrice(draft, material);
    material.price = current;
    material.pricing = { mode: value, value: value === 'margin' ? Math.max(0, Math.min(.99, current ? 1 - cost / current : .4)) : value === 'markup' ? Math.max(0, cost ? current / cost - 1 : .85) : 0 };
    changed(); render(); return;
  }
  setPath(path, value); changed();
  if (path.endsWith('.unit') || path.endsWith('.kind')) render();
}
async function confirmAction(title, message, label = 'Continuar') {
  const dialog = $('#confirm-dialog'); $('#confirm-title').textContent = title; $('#confirm-message').textContent = message; $('#confirm-accept').textContent = label;
  dialog.returnValue = ''; dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'accept'), { once: true }));
}
function downloadJson(state, name) {
  const blob = new Blob([JSON.stringify(state, null, 2) + '\n'], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function assertValid() {
  const invalidInput = document.querySelector('[aria-invalid="true"]');
  if (invalidFields.size || invalidInput) { invalidInput?.focus(); throw new Error('Corrige el campo señalado antes de continuar. Puedes descartar el borrador para volver a la versión guardada.'); }
  const errors = validate(draft); if (errors.length) throw new Error(errors.join('\n'));
}
function openSave() {
  try { assertValid(); $('#version-label').value = `Tarifa · ${new Date().toLocaleDateString('es-ES')}`; $('#save-summary').textContent = `${priceChanges()}. ${draft.materials.filter(item => item.active).length} materiales activos. Se conservarán las versiones anteriores.`; $('#save-dialog').showModal(); }
  catch (exception) { error(exception.message); }
}
async function exportVersion(revision) {
  const result = await api('/api/export', { method: 'POST', body: JSON.stringify({ revision }) });
  toast(`PDF guardado: exports/${result.file}`);
  const link = document.createElement('a'); link.href = result.url; link.download = result.file; link.click();
  if ($('#export-result')) $('#export-result').innerHTML = `<div class="pdf-result">PDF guardado en exports/. <a href="${result.url}" target="_blank" rel="noopener">Abrir para imprimir</a></div>`;
}
async function preview() {
  assertValid();
  $('#preview-caption').textContent = 'Preparando vista previa…'; $('#pdf-frame').removeAttribute('src'); $('#preview-link').removeAttribute('href'); $('#preview-dialog').showModal();
  try {
    const blob = await api('/api/preview', { method: 'POST', body: JSON.stringify(draft) });
    if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = URL.createObjectURL(blob);
    $('#pdf-frame').src = previewUrl; $('#preview-link').href = previewUrl;
    $('#preview-caption').textContent = isDirty() ? 'Borrador · no crea una versión · A4' : `${saved.versionLabel} · A4`;
  } catch (exception) { $('#preview-dialog').close(); throw exception; }
}
async function action(name, target) {
  if (invalidFields.size && name !== 'discard') { assertValid(); }
  const material = draft.materials.find(item => item.id === selectedId);
  if (name === 'new-material') {
    const id = uid('material'); draft.materials.push({ id, name: 'Nuevo material', category: 'Nueva familia', description: '', supplier: '', unit: 'm2', active: true, cost: 0, inkCost: null, referenceQty: 1, rolls: [], pricing: { mode: 'margin', value: .4 }, price: 0, supplements: {}, hiddenRows: [] });
    selectedId = id; search = family = ''; changed(); render(); $('#material-editor details:nth-of-type(2)')?.setAttribute('open', ''); toast('Material creado en el borrador. Completa nombre y coste; sus acabados se asignan en Acabados.');
  } else if (name === 'bump-cost') { material.cost = round(material.cost * (1 + Number(target.dataset.rate)), .0001); changed(); render();
  } else if (name === 'duplicate-material') {
    const next = clone(material); next.id = uid('material'); next.name = `${material.name} (copia)`.slice(0, 100); next.rolls.forEach(roll => { roll.id = uid('roll'); });
    draft.finishes.forEach(finish => { if (finish.materialIds.includes(material.id)) finish.materialIds.push(next.id); }); draft.materials.push(next); selectedId = next.id; changed(); render();
  } else if (name === 'archive-material') { material.active = !material.active; changed(); render(); toast(material.active ? 'Material reactivado.' : 'Material archivado. No aparecerá en el PDF.');
  } else if (name === 'new-finish') { draft.finishes.push({ id: uid('finish'), name: 'Nuevo acabado', kind: 'process', label: '', cost: null, supplement: 0, materialIds: [], rolls: [] }); changed(); render();
  } else if (name === 'remove-finish') {
    const finish = draft.finishes.find(item => item.id === target.dataset.id);
    if (await confirmAction('Eliminar acabado', finish.materialIds.length ? `Se quitará de ${finish.materialIds.length} materiales y desaparecerán sus filas de la tarifa.` : 'Se eliminará del catálogo en borrador.', 'Eliminar acabado')) { draft.finishes = draft.finishes.filter(item => item !== finish); draft.materials.forEach(item => { delete item.supplements[finish.id]; }); changed(); render(); }
  } else if (name === 'apply-suggestion') { draft.finishes.find(item => item.id === target.dataset.id).supplement = Number(target.dataset.value); changed(); render();
  } else if (name === 'add-roll') { const owner = getPath(target.dataset.path); let width = 1.37; while (owner.rolls.some(item => item.width === width)) width = round(width + .1, .01); owner.rolls.push({ id: uid('roll'), width, cost: null }); changed(); render();
  } else if (name === 'remove-roll') { getPath(target.dataset.path).rolls.splice(Number(target.dataset.index), 1); changed(); render();
  } else if (name === 'batch-margin') {
    const input = $('#batch-margin'); if (!input.checkValidity() || input.value === '') throw new Error('Introduce un margen entre 0 y 99 %.');
    for (const item of draft.materials) item.pricing = { mode: 'margin', value: Number(input.value) / 100 };
    changed(); render(); toast(`Margen aplicado al precio base de ${draft.materials.length} materiales en el borrador.`);
  } else if (name === 'discard') {
    if (await confirmAction('Descartar el borrador', 'Volverás a la última versión guardada. Los cambios sin guardar se perderán.', 'Descartar cambios')) { invalidFields.clear(); draft = clone(saved); changed(); render(); }
  } else if (name === 'backup') { downloadJson(materialize(draft), `Impress-catalogo-${isDirty() ? 'borrador' : saved.revision}.json`);
  } else if (name === 'import') { $('#import-file').click();
  } else if (name === 'restore-version') {
    if (isDirty() && !await confirmAction('Recuperar esta versión', 'Sustituirá el borrador actual. La tarifa guardada se mantendrá hasta que guardes una nueva versión.', 'Recuperar')) return;
    const state = await api(`/api/version/${target.dataset.id}`); draft = clone(state); changed(); view = 'tariff'; selectedId = draft.materials[0]?.id; render(); toast('Versión recuperada como borrador. Revisa y guarda cuando esté lista.');
  } else if (name === 'export-version') { await exportVersion(target.dataset.id);
  } else if (name === 'delete-version') {
    if (!await confirmAction('Borrar versión', `«${target.dataset.label}» (${target.dataset.date}) pasará a la carpeta papelera/ de los datos. Desde ahí se puede rescatar.`, 'Borrar')) return;
    try { await api(`/api/version/${target.dataset.id}`, { method: 'DELETE' }); toast('Versión movida a la papelera.'); } finally { renderHistory(); }
  } else if (name === 'preview') { await preview(); }
}

document.addEventListener('click', async event => {
  if (busy) return;
  const close = event.target.closest('[data-close]'); if (close) { document.getElementById(close.dataset.close).close(); return; }
  const nav = event.target.closest('[data-view]'); if (nav) { if (invalidFields.size) { error('Corrige el campo numérico señalado o descarta el borrador antes de cambiar de sección.'); return; } view = nav.dataset.view; history.replaceState(null, '', `#${view}`); render(); return; }
  const select = event.target.closest('[data-select]'); if (select) { if (invalidFields.size) { error('Corrige el campo numérico señalado o descarta el borrador antes de cambiar de material.'); return; } selectedId = select.dataset.select; $('#catalog-list').innerHTML = renderCatalogTable(); $('#material-editor').innerHTML = materialEditor(); return; }
  const target = event.target.closest('[data-action]'); if (!target || busy) return;
  try { error(''); await action(target.dataset.action, target); } catch (exception) { error(exception.message); }
});
document.addEventListener('input', event => {
  const target = event.target;
  if (target.id === 'material-search') { search = target.value; $('#catalog-list').innerHTML = renderCatalogTable(); return; }
  if (target.dataset.bind && target.tagName !== 'SELECT') handleBinding(target);
  if (target.dataset.lines) { draft.document[target.dataset.lines] = target.value.split('\n').filter(line => line.trim()); changed(); }
  if (target.dataset.sim && target.tagName !== 'SELECT') { simulationInput[target.dataset.sim] = Number(target.value); refreshComputed(); }
  if (target.dataset.supplement !== undefined) {
    const material = draft.materials[Number(target.dataset.supplement)], key = `supplement.${material.id}.${target.dataset.finish}`;
    const value = target.value === '' ? null : Number(target.value);
    if (value !== null && (!target.checkValidity() || !Number.isFinite(value))) { error('Revisa el suplemento: usa un número mayor o igual que cero, o déjalo vacío.'); target.setAttribute('aria-invalid', 'true'); invalidFields.add(key); updateStatus(); return; }
    target.removeAttribute('aria-invalid'); invalidFields.delete(key);
    if (value === null) delete material.supplements[target.dataset.finish]; else material.supplements[target.dataset.finish] = value;
    changed();
  }
});
document.addEventListener('change', event => {
  const target = event.target;
  if (target.closest('#merge-form')) { merging.choices[target.name] = target.value; refreshMerge(); return; }
  if (target.dataset.bind && target.tagName === 'SELECT') handleBinding(target);
  if (target.id === 'family-filter') { family = target.value; $('#catalog-list').innerHTML = renderCatalogTable(); }
  if (target.id === 'show-archived') { showArchived = target.checked; $('#catalog-list').innerHTML = renderCatalogTable(); }
  if (target.dataset.sim && target.tagName === 'SELECT') { simulationInput[target.dataset.sim] = target.value; if (target.dataset.sim === 'materialId') render(); else refreshComputed(); }
  if (target.dataset.groupToggle !== undefined) {
    if (invalidFields.size) { target.checked = !target.checked; error('Corrige primero el campo numérico señalado.'); return; }
    const groups = draft.document.groups ?? [];
    const first = draft.materials.find(item => item.category === target.value);
    draft.document.groups = target.checked ? [...groups, { category: target.value, title: target.value, description: '', tagline: first?.tagline || '' }] : groups.filter(item => item.category !== target.value);
    changed(); render(); return;
  }
  if (target.dataset.rowToggle !== undefined) {
    const material = draft.materials[Number(target.dataset.rowToggle)], hidden = new Set(material.hiddenRows);
    if (target.checked) hidden.delete(target.value); else hidden.add(target.value);
    if (material.active && !priceRows(draft, { ...material, hiddenRows: [...hidden] }).length) { target.checked = true; error('Deja al menos una fila visible en la tarifa.'); return; }
    material.hiddenRows = [...hidden]; changed();
  }
  if (target.dataset.finishMaterial !== undefined) {
    if (invalidFields.size) { target.checked = !target.checked; error('Corrige primero el campo numérico señalado.'); return; }
    const finish = draft.finishes[Number(target.dataset.finishMaterial)], material = draft.materials.find(item => item.id === target.value);
    if (target.checked) {
      if (finish.kind !== 'laminate' && compatibleFinishes(draft, material).filter(item => item.kind !== 'laminate').length >= 4) { target.checked = false; error('Un material admite como máximo cuatro acabados de proceso.'); return; }
      finish.materialIds.push(material.id); toast(`${material.name}: nuevas filas en la tarifa. Puedes ocultarlas en su ficha.`);
    } else { finish.materialIds = finish.materialIds.filter(id => id !== material.id); delete material.supplements[finish.id]; }
    changed(); render();
  }
});
$('#save-button').addEventListener('click', () => { exportAfterSave = false; openSave(); });
$('#preview-button').addEventListener('click', () => preview().catch(exception => error(exception.message)));
$('#export-button').addEventListener('click', () => { try { assertValid(); if (isDirty()) { exportAfterSave = true; openSave(); } else exportVersion(saved.revision).catch(exception => error(exception.message)); } catch (exception) { error(exception.message); } });
$('#backup-button').addEventListener('click', () => action('backup', {}).catch(exception => error(exception.message)));
$('#save-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return; busy = true; $('#save-form button[type=submit]').disabled = true; $('#save-dialog [data-close]').disabled = true; $('#main').inert = true;
  let stale = false;
  try {
    assertValid(); const snapshot = clone(draft); const current = await api('/api/state', { method: 'PUT', body: JSON.stringify({ state: snapshot, expectedRevision: saved.revision, label: $('#version-label').value }) });
    saved = current; draft = clone(current); persistDraft(); $('#save-dialog').close(); render(); toast('Versión guardada. La anterior sigue disponible en el historial.'); if (exportAfterSave) await exportVersion(saved.revision);
  } catch (exception) { $('#save-dialog').close(); if (exception.code === 'STALE') stale = true; else error(exception.message); }
  finally { busy = false; exportAfterSave = false; $('#save-form button[type=submit]').disabled = false; $('#save-dialog [data-close]').disabled = false; $('#main').inert = false; updateStatus(); }
  // Someone saved elsewhere first: bring their version into the draft, then review and save again.
  if (stale) checkRemote({ manual: true });
});
$('#save-dialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 2000000) throw new Error('El catálogo supera los 2 MB.'); const candidate = migrate(JSON.parse(await file.text())); const errors = validate(candidate); if (errors.length) throw new Error(errors.join('\n'));
    if (await confirmAction('Importar catálogo como borrador', `Se cargarán ${candidate.materials.length} materiales. ${isDirty() ? 'Sustituirá tus cambios sin guardar.' : 'La versión guardada se mantendrá.'}`, 'Importar borrador')) { draft = candidate; selectedId = draft.materials[0]?.id; view = 'tariff'; changed(); render(); }
  } catch (exception) { error(exception.message); } finally { event.target.value = ''; }
});
// Versions saved elsewhere (another computer or window) come into the draft by a three-way merge; only conflicts ask.
let remote = null, deferredRevision = null, checking = false, merging = null;
const plural = (count, one, many) => count === 1 ? `1 ${one}` : `${count} ${many}`;
const listText = items => items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : items[0] ?? '';
function incomingText(theirs, { added, removed, changed: edits }) {
  const count = scope => added.filter(item => item.scope === scope).length;
  const parts = [count('material') && plural(count('material'), 'material nuevo', 'materiales nuevos'), count('finish') && plural(count('finish'), 'acabado nuevo', 'acabados nuevos'),
    removed.length && plural(removed.length, 'acabado quitado', 'acabados quitados'), edits.length && plural(edits.length, 'cambio', 'cambios')].filter(Boolean);
  const verb = added.length + removed.length + edits.length === 1 ? 'Entra' : 'Entran';
  return `${parts.length ? `${verb} ${listText(parts)} de «${theirs.versionLabel}», guardada` : `Se ha incorporado «${theirs.versionLabel}», guardada`} desde otro ordenador. Tus cambios siguen en el borrador.`;
}
// Never swap the state under the user's hands: wait while saving, in a dialog, with a field in error or the cursor in a field.
const canMerge = () => !busy && !invalidFields.size && !document.querySelector('dialog[open]') && !document.activeElement?.matches('input, textarea, select');
function hideRemote() { remote = null; $('#remote-banner').hidden = true; }
// The draft is rebased on `theirs`: it becomes the saved version and the merge result the draft.
function rebase(theirs, state) { saved = theirs; draft = state; hideRemote(); changed(); render(); }
async function checkRemote({ manual = false } = {}) {
  if (!saved || (!manual && (checking || document.visibilityState !== 'visible'))) return;
  checking = true;
  try {
    const { revision } = await api('/api/revision');
    if (revision === saved.revision || (!manual && !canMerge())) return;
    if (!manual && isDirty() && [deferredRevision, remote?.theirs.revision].includes(revision)) return;
    const theirs = await api('/api/state');
    if (theirs.revision === saved.revision || (!manual && !canMerge())) return;
    if (!isDirty()) { rebase(theirs, clone(theirs)); toast(`Se ha cargado «${theirs.versionLabel}», guardada desde otro ordenador.`, 9000); return; }
    const result = mergeCatalogs(saved, draft, theirs);
    if (!result.conflicts.length && !result.errors.length) { rebase(theirs, result.state); toast(`${incomingText(theirs, result.summary)}${manual ? ' Revisa y vuelve a guardar.' : ''}`, 9000); return; }
    remote = { base: saved, theirs };
    if (manual) { openMerge(remote); return; }
    const banner = $('#remote-banner'), label = escape(theirs.versionLabel); banner.hidden = false;
    banner.innerHTML = result.conflicts.length
      ? `Se ha guardado «${label}» desde otro ordenador y choca con tu borrador. <button class="button small" id="remote-resolve">Resolver</button><button class="text-button" id="remote-later">Más tarde</button>`
      : `Se ha guardado «${label}» desde otro ordenador. Al juntarla con tu borrador quedan datos que revisar. <button class="button small" id="remote-resolve">Revisar</button><button class="text-button" id="remote-later">Más tarde</button>`;
    $('#remote-resolve').onclick = () => openMerge(remote);
    $('#remote-later').onclick = () => { deferredRevision = remote.theirs.revision; hideRemote(); };
  } catch (exception) { if (manual) error(`Otra versión se guardó antes que la tuya y no se ha podido leer. ${exception.message}`); }
  finally { checking = false; }
}
setInterval(() => checkRemote(), 5000);
document.addEventListener('visibilitychange', () => checkRemote());
window.addEventListener('focus', () => checkRemote());

const scopeTitles = { material: 'Material', finish: 'Acabado', settings: 'Costes y descuentos', document: 'Documento A4', catalog: 'Catálogo' };
function formatValue(field, value) {
  const key = String(field).split('.')[0];
  if (value === undefined || value === '') return '(vacío)';
  if (value === null) return key === 'inkCost' ? 'La general' : 'Pendiente';
  if (key === 'pricing') return value.mode === 'fixed' ? `Precio fijo ${currency(value.price)}` : `${value.mode === 'margin' ? 'Margen' : 'Recargo'} ${number(value.value * 100)} %`;
  if (['supplements', 'cost', 'supplement', 'inkCost', 'setupCost'].includes(key)) return `${number(value, 4)} €`;
  if (key === 'active') return value ? 'Activo' : 'Archivado';
  if (key === 'unit') return value === 'm2' ? 'm²' : 'ud.';
  if (key === 'kind') return value === 'laminate' ? 'Laminado' : 'Proceso';
  if (key === 'wasteLength') return `${number(value)} m`;
  if (key === 'rolls') return value.map(roll => `${number(roll.width)} m${roll.cost === null ? '' : ` (${number(roll.cost, 4)} €)`}`).join(', ') || 'Sin bobinas';
  if (key === 'tiers') return value.map(tier => `desde ${number(tier.minimum)}: −${number(tier.rate * 100)} %`).join(' · ');
  if (key === 'groups') return value.map(group => group.title).join(', ') || 'Ninguno';
  if (Array.isArray(value)) return value.join(' · ') || '(vacío)';
  return typeof value === 'number' ? number(value, 4) : String(value);
}
function mergeItem(conflict) {
  const whole = conflict.field === null;
  const option = side => {
    const value = conflict[side], text = whole ? (value ? `Mantenerlo con ${side === 'mine' ? 'tus' : 'sus'} cambios` : 'Quitarlo') : formatValue(conflict.field, value);
    const price = conflict.scope === 'material' ? `<small data-merge-key="${escape(conflict.key)}" data-merge-side="${side}"></small>` : '';
    return `<label class="merge-option"><input type="radio" name="${escape(conflict.key)}" value="${side}" ${side === 'mine' ? 'checked' : ''}><span><strong>${side === 'mine' ? 'Lo tuyo' : 'Lo suyo'}</strong> ${escape(text)}${price}</span></label>`;
  };
  return `<div class="merge-item"><div class="merge-field">${escape(conflict.label)}${whole ? '' : `<small>Antes: ${escape(formatValue(conflict.field, conflict.base))}</small>`}</div><div class="merge-options">${option('mine')}${option('theirs')}</div></div>`;
}
const mergeResult = (extra = {}) => mergeCatalogs(merging.base, merging.mine, merging.theirs, { ...merging.choices, ...extra });
function openMerge({ base, theirs, mine = draft, intro, after }) {
  if (invalidFields.size) { error('Corrige el campo señalado antes de incorporar los cambios.'); return; }
  merging = { base, mine: clone(mine), theirs, after, choices: {} };
  const { conflicts } = mergeResult(), groups = new Map();
  for (const conflict of conflicts) {
    const key = `${conflict.scope}:${conflict.id ?? ''}`;
    if (!groups.has(key)) groups.set(key, { title: conflict.id ? `${scopeTitles[conflict.scope]} · ${conflict.name}` : scopeTitles[conflict.scope] ?? conflict.scope, items: [] });
    groups.get(key).items.push(conflict);
  }
  $('#merge-intro').textContent = intro ?? `«${theirs.versionLabel}» se guardó desde otro ordenador. ${conflicts.length ? 'Elige qué conservar donde no coincide con tu borrador; lo demás se junta solo.' : 'No hay nada que elegir.'}`;
  $('#merge-list').innerHTML = [...groups.values()].map(group => `<section class="merge-group"><h3>${escape(group.title)}</h3>${group.items.map(mergeItem).join('')}</section>`).join('');
  $('#merge-dialog').querySelectorAll('[data-merge-all]').forEach(button => { button.hidden = !conflicts.length; });
  refreshMerge(); $('#merge-dialog').showModal();
}
// Each material option shows the base price it leads to, given the other choices.
function refreshMerge() {
  document.querySelectorAll('[data-merge-key]').forEach(item => {
    const conflict = { key: item.dataset.mergeKey, id: item.dataset.mergeKey.split(':')[1] };
    try { const { state } = mergeResult({ [conflict.key]: item.dataset.mergeSide }), material = state.materials.find(entry => entry.id === conflict.id); item.textContent = material ? `Precio base: ${currency(basePrice(state, material))}` : ''; }
    catch { item.textContent = ''; }
  });
  const { errors } = mergeResult(); $('#merge-errors').hidden = !errors.length;
  $('#merge-errors').textContent = `Quedarán datos que revisar antes de guardar:\n${errors.join('\n')}`;
}
$('#merge-dialog').addEventListener('click', event => {
  const all = event.target.closest('[data-merge-all]'); if (!all) return;
  $('#merge-list').querySelectorAll(`input[value="${all.dataset.mergeAll}"]`).forEach(input => { input.checked = true; merging.choices[input.name] = input.value; });
  refreshMerge();
});
$('#merge-form').addEventListener('submit', event => {
  event.preventDefault();
  const result = mergeResult(), { theirs, after } = merging;
  $('#merge-dialog').close(); rebase(theirs, result.state); after?.();
  if (result.errors.length) error(`Cambios incorporados al borrador. Antes de guardar, revisa:\n${result.errors.join('\n')}`);
  else toast('Cambios incorporados al borrador. Revisa y guarda cuando esté listo.');
});
$('#merge-dialog').addEventListener('close', () => { merging = null; });
window.addEventListener('beforeunload', event => { if (draft && (isDirty() || invalidFields.size || busy)) { event.preventDefault(); event.returnValue = ''; } });
// Read by the desktop app before changing the data folder: a draft (current or waiting to be recovered) belongs to this catalog.
window.hasUnsavedChanges = () => { let stored = null; try { stored = localStorage.getItem(storageKey); } catch {} return Boolean(draft && (isDirty() || invalidFields.size || busy)) || stored !== null; };
async function initialize() {
  try {
    saved = await api('/api/state'); draft = clone(saved); selectedId = draft.materials[0]?.id;
    const requested = location.hash.slice(1); if (['tariff','finishes','settings','simulator','document','history'].includes(requested)) view = requested;
    try { recoveredDraft = JSON.parse(localStorage.getItem(storageKey) ?? localStorage.getItem(legacyStorageKey)); if (recoveredDraft?.state) recoveredDraft.state = migrate(recoveredDraft.state); } catch { recoveredDraft = null; }
    render();
    if (recoveredDraft?.state && JSON.stringify(recoveredDraft.state) !== JSON.stringify(saved)) {
      const banner = $('#recovery-banner'); banner.hidden = false;
      const older = recoveredDraft.baseRevision !== saved.revision;
      // The label is set now; whether to merge is decided on click, since the saved version may change meanwhile.
      banner.innerHTML = `Hay un borrador de una sesión anterior.${older ? ` Se hizo sobre otra versión: al recuperarlo se le incorporan los cambios de «${escape(saved.versionLabel)}».` : ''} <button class="button small" id="recover-draft">${older ? 'Recuperar e incorporar' : 'Recuperar borrador'}</button><button class="text-button" id="forget-draft">Descartar</button>`;
      $('#recover-draft').onclick = async () => {
        if ((isDirty() || invalidFields.size) && !await confirmAction('Sustituir el borrador actual', 'Has realizado cambios en esta sesión. Recuperar el borrador anterior los sustituirá.', 'Recuperar anterior')) return;
        invalidFields.clear(); const done = () => { banner.hidden = true; recoveredDraft = null; };
        if (recoveredDraft.baseRevision === saved.revision) { draft = recoveredDraft.state; selectedId = draft.materials[0]?.id; done(); changed(); render(); toast('Borrador recuperado. Revisa los cambios antes de guardar.'); return; }
        // Its starting version may be in papelera/; if it is gone, every difference becomes a choice.
        const base = await api(`/api/version/${recoveredDraft.baseRevision}`).catch(() => ({ settings: {}, document: {}, materials: [], finishes: [] }));
        const result = mergeCatalogs(base, recoveredDraft.state, saved);
        if (result.conflicts.length || result.errors.length) { openMerge({ base, mine: recoveredDraft.state, theirs: saved, after: done, intro: `Tu borrador anterior se hizo sobre otra versión. Elige qué conservar donde no coincide con «${saved.versionLabel}»; lo demás se junta solo.` }); return; }
        rebase(saved, result.state); done(); toast(`Borrador recuperado con los cambios de «${saved.versionLabel}». Revisa antes de guardar.`);
      };
      $('#forget-draft').onclick = () => { persistDraft(); banner.hidden = true; recoveredDraft = null; };
    }
  } catch (exception) {
    const newer = exception.code === 'NEWER_DATA';
    error(newer ? exception.message : `No se pudo abrir el catálogo. ${exception.message} Comprueba que el servidor sigue en marcha y recarga la página.`);
    $('#main').innerHTML = `<div class="empty-state"><h1>No se ha cargado el catálogo</h1><p>${newer ? 'Los datos no se han tocado.' : 'Los datos guardados siguen en la carpeta de datos.'}</p><button class="button" id="retry-load">Volver a intentar</button></div>`; $('#retry-load').onclick = initialize;
  }
}
initialize();
