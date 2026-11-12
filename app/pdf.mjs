import { deflateSync } from 'node:zlib';
import { priceRows, currency, number, unitLabel } from './model.mjs';

const PAGE_WIDTH = 595.2756;
const PAGE_HEIGHT = 841.8898;
const COLORS = { ink: [0.025, 0.035, 0.035], orange: [0.96, 0.32, 0.075], red: [0.70, 0.15, 0.035], gray: [0.35, 0.37, 0.38], line: [0.82, 0.83, 0.83], pale: [1, 0.95, 0.90], light: [0.94, 0.94, 0.94], white: [1, 1, 1] };
const characterMap = { '€': 128, '•': 149, '–': 150, '—': 151, '’': 146, '‘': 145, '“': 147, '”': 148, '…': 133 };
const normalize = value => String(value).normalize('NFC').replace(/≥/g, '>=').replace(/\u202f|\u00a0/g, ' ');
// Adobe AFM advance widths (1/1000 em) for WinAnsi codes 32–255; zeros are undefined codes.
const METRICS = {
  regular: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
  bold: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,0,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556]
};
const codes = value => [...normalize(value)].map(char => characterMap[char] ?? (char.codePointAt(0) <= 255 ? char.codePointAt(0) : 63));
const encoded = value => Buffer.from(codes(value)).toString('hex');
function width(value, size, bold = false) {
  const table = bold ? METRICS.bold : METRICS.regular;
  return codes(value).reduce((sum, code) => sum + (code < 32 ? 0 : table[code - 32] || 556), 0) * size / 1000;
}
function wrap(value, maxWidth, size, bold = false) {
  const result = [];
  for (const paragraph of normalize(value).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (width(`${line} ${word}`.trim(), size, bold) > maxWidth && line) { result.push(line); line = ''; }
      if (width(word, size, bold) > maxWidth) {
        for (const char of word) { if (width(line + char, size, bold) > maxWidth && line) { result.push(line); line = ''; } line += char; }
      } else line += (line ? ' ' : '') + word;
    }
    result.push(line);
  }
  return result;
}

export function generatePdf(state, logo) {
  const groups = state.document.groups ?? [];
  const publicStrings = [state.document.title, state.document.subtitle ?? '', state.document.edition, ...groups.flatMap(group => [group.title, group.description, group.tagline]), state.document.company, state.document.contact, ...state.document.notes, ...state.document.shipping, ...state.finishes.filter(item => item.kind === 'laminate').map(item => item.name), ...state.materials.filter(item => item.active).flatMap(item => [item.displayName || item.name, item.category, item.description, item.tagline ?? '', ...priceRows(state, item).map(row => row.label)])];
  for (const value of publicStrings) {
    const unsupported = [...normalize(value)].find(char => char.codePointAt(0) > 255 && !characterMap[char]);
    if (unsupported) throw new Error(`El PDF no admite el carácter «${unsupported}». Sustitúyelo en el contenido público; se admiten letras latinas, acentos, € y signos habituales.`);
  }
  const pages = [];
  let commands, y, blocks;
  const rgb = color => color.join(' ');
  function rectangle(x, top, w, h, color, stroke = false) { commands.push(`${rgb(color)} ${stroke ? 'RG' : 'rg'} ${x} ${PAGE_HEIGHT - top - h} ${w} ${h} re ${stroke ? 'S' : 'f'}`); }
  function text(value, x, top, size = 10, bold = false, color = COLORS.ink, align = 'left') {
    if (align === 'right') x -= width(value, size, bold);
    if (align === 'center') x -= width(value, size, bold) / 2;
    commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x} ${PAGE_HEIGHT - top - size} Tm <${encoded(value)}> Tj ET`);
  }
  function lines(value, x, top, maxWidth, size, bold = false, color = COLORS.ink, leading = size * 1.4) {
    const items = wrap(value, maxWidth, size, bold);
    items.forEach((line, index) => text(line, x, top + index * leading, size, bold, color));
    return items.length * leading;
  }
  function newPage() {
    commands = []; pages.push(commands); y = 132; blocks = 0;
    rectangle(36, 36, PAGE_WIDTH - 72, 72, COLORS.ink);
    rectangle(36, 108, PAGE_WIDTH - 72, 5, COLORS.orange);
    commands.push(`q 135 0 0 31.5726 52 ${PAGE_HEIGHT - 57 - 31.5726} cm /Logo Do Q`);
    let titleSize = 18;
    while (wrap(state.document.title, 340, titleSize, true).length > 2) titleSize -= .5;
    const titleLines = wrap(state.document.title, 340, titleSize, true);
    titleLines.forEach((line, index) => text(line, 205, 47 + index * 21, titleSize, true, COLORS.white));
    text(state.document.subtitle || state.document.edition, 205, titleLines.length > 1 ? 94 : 80, 9, false, COLORS.white);
  }
  const ensure = height => { if (y + height > 773) newPage(); };
  newPage();
  const activeUnits = [...new Set(state.materials.filter(item => item.active).map(unitLabel))];
  const tierUnit = activeUnits.length ? activeUnits.join(' / ') : 'm²';
  text('Descuentos por cantidad', 36, y, 15, true); y += 27;
  state.settings.tiers.forEach((tier, index) => {
    const x = 36 + index * 179;
    rectangle(x, y, 165, 48, COLORS.pale);
    text(`-${number(tier.rate * 100)}%`, x + 12, y + 9, 20, true, COLORS.red);
    const threshold = `Desde ${number(tier.minimum)} ${tierUnit}`;
    text(threshold, x + 72, y + 9, Math.min(8.8, 85 / width(threshold, 1, true)), true);
    text('Sobre precio base', x + 72, y + 25, 8, false, COLORS.gray);
  });
  y += 70;
  const active = state.materials.filter(item => item.active);
  const laminatesOf = items => state.finishes.filter(finish => finish.kind === 'laminate' && items.some(item => priceRows(state, item).some(row => row.finishes.includes(finish)))).map(finish => finish.name);
  const sections = [];
  for (const material of active) {
    const group = groups.find(item => item.category === material.category);
    if (!group) { sections.push({ category: material.category, tagline: material.tagline ?? '', title: material.displayName || material.name, description: material.description, unit: unitLabel(material), laminates: laminatesOf([material]), rows: priceRows(state, material) }); continue; }
    if (sections.some(item => item.group === group)) continue;
    const members = active.filter(item => item.category === group.category);
    sections.push({ group, category: group.category, tagline: group.tagline || material.tagline || '', title: group.title, description: group.description, unit: unitLabel(material), laminates: laminatesOf(members),
      rows: members.flatMap(item => priceRows(state, item).map(row => ({ ...row, label: `${item.displayName || item.name} · ${row.label}` }))) });
  }
  for (const section of sections) {
    let remaining = section.rows;
    let continuation = false;
    while (remaining.length) {
      if (blocks >= 2) newPage();
      const title = `${section.title}${continuation ? ' (continuación)' : ''}`;
      const titleHeight = wrap(title, 485, 17, true).length * 21;
      const descHeight = section.description ? wrap(section.description, 485, 9).length * 13 : 0;
      const laminateNames = section.laminates;
      const laminateText = laminateNames.length ? `Laminado incluido: ${laminateNames.join(' · ')}` : '';
      const laminateHeight = laminateText ? wrap(laminateText, 485, 8).length * 12 + 3 : 0;
      const overhead = 94 + titleHeight + descHeight + laminateHeight;
      const batch = [], rowHeights = [];
      let height = overhead;
      for (const row of remaining) {
        const rowHeight = Math.max(27, wrap(row.label, 199, 9, true).length * 12 + 10);
        if (y + height + rowHeight > 773 || batch.length >= 12) break;
        batch.push(row); rowHeights.push(rowHeight); height += rowHeight;
      }
      if (!batch.length) { if (y === 132) throw new Error('Un bloque de material es demasiado alto para A4. Acorta su descripción.'); newPage(); continue; }
      if (batch.length < Math.min(remaining.length, 4) && y > 132) { newPage(); continue; }
      remaining = remaining.slice(batch.length);
      rectangle(36, y, PAGE_WIDTH - 72, height, COLORS.line, true);
      rectangle(36, y, PAGE_WIDTH - 72, 30, COLORS.ink); rectangle(36, y, 5, 30, COLORS.orange);
      const category = section.category.toUpperCase();
      let categorySize = 12;
      while (width(category, categorySize, true) > (section.tagline ? 300 : 480) && categorySize > 7) categorySize -= .5;
      text(category, 50, y + 7, categorySize, true, COLORS.white);
      if (section.tagline) {
        let taglineSize = 8.5;
        const room = 480 - width(category, categorySize, true) - 16;
        while (width(section.tagline, taglineSize) > room && taglineSize > 6) taglineSize -= .25;
        text(section.tagline, PAGE_WIDTH - 50, y + 15 - taglineSize / 2, taglineSize, false, COLORS.white, 'right');
      }
      let inner = y + 42;
      inner += lines(title, 50, inner, 485, 17, true, COLORS.ink, 21);
      if (section.description) inner += lines(section.description, 50, inner + 2, 485, 9, false, COLORS.gray, 13);
      if (laminateText) inner += lines(laminateText, 50, inner + 5, 485, 8, false, COLORS.red, 12) + 3;
      inner += 12;
      const tableX = 50, tableW = 495, firstW = 211, columnW = 71;
      rectangle(tableX, inner, tableW, 25, COLORS.light);
      text(`Acabado · €/${section.unit} · Sin IVA`, tableX + 7, inner + 7, 8, true, COLORS.gray);
      const headings = ['Base', ...state.settings.tiers.map(tier => `${number(tier.minimum)} ${section.unit}`)];
      headings.forEach((heading, index) => text(heading, tableX + firstW + columnW * (index + .5), inner + 7, Math.min(8.3, 64 / width(heading, 1, true)), true, COLORS.gray, 'center'));
      inner += 25;
      batch.forEach((row, rowIndex) => {
        const h = rowHeights[rowIndex];
        rectangle(tableX, inner, tableW, h, rowIndex % 2 ? COLORS.pale : COLORS.white);
        lines(row.label, tableX + 7, inner + 7, 199, 9, rowIndex % 2 === 1, rowIndex % 2 ? COLORS.red : COLORS.ink, 12);
        [row.price, ...row.tiers].forEach((price, index) => text(currency(price), tableX + firstW + columnW * (index + .5), inner + 7, Math.min(9.2, 64 / width(currency(price), 1, true)), true, rowIndex % 2 ? COLORS.red : COLORS.ink, 'center'));
        rectangle(tableX, inner + h - .35, tableW, .35, COLORS.line);
        inner += h;
      });
      y += height + 22; blocks += 1; continuation = true;
    }
  }
  function paragraphSection(title, paragraphs) {
    ensure(75);
    rectangle(36, y, PAGE_WIDTH - 72, 29, COLORS.pale);
    text(title, 49, y + 5, 14, true, COLORS.red); y += 39;
    for (const paragraph of paragraphs) {
      const wrapped = wrap(`• ${paragraph}`, 492, 10);
      for (const line of wrapped) { ensure(18); text(line, 49, y, 10); y += 15; }
      y += 8;
    }
    y += 16;
  }
  // Commercial conditions start on their own page, as in the reference tariff.
  if (sections.length) newPage();
  paragraphSection('Observaciones', state.document.notes);
  paragraphSection('Gastos de envío', state.document.shipping);
  const contactLines = [...wrap(state.document.company, 485, 10, true), ...wrap(state.document.contact, 485, 10)];
  const contactHeight = contactLines.length * 16 + 26;
  ensure(contactHeight); y = 773 - contactHeight;
  rectangle(36, y, PAGE_WIDTH - 72, contactHeight, COLORS.ink);
  contactLines.forEach((line, index) => text(line, 49, y + 11 + index * 16, 10, index === 0, COLORS.white));
  for (let index = 0; index < pages.length; index++) {
    commands = pages[index]; rectangle(36, 799, PAGE_WIDTH - 72, .4, COLORS.line);
    text(`IMPRESS · ${state.document.edition}`, 36, 807, 8, false, COLORS.gray);
    text(`Página ${index + 1}/${pages.length}`, 490, 807, 8, false, COLORS.gray);
  }
  const objects = [];
  const add = body => { objects.push(Buffer.isBuffer(body) ? body : Buffer.from(body, 'ascii')); return objects.length; };
  const stream = (dictionary, bytes) => Buffer.concat([Buffer.from(`<< ${dictionary} /Length ${bytes.length} >>\nstream\n`), bytes, Buffer.from('\nendstream')]);
  const catalogId = add(''); const pagesId = add('');
  const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const logoId = add(stream('/Type /XObject /Subtype /Image /Width 620 /Height 145 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', logo));
  const pageIds = pages.map(page => {
    const contentId = add(stream('/Filter /FlateDecode', deflateSync(Buffer.from(page.join('\n'), 'ascii'))));
    return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> /XObject << /Logo ${logoId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  });
  objects[catalogId - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  objects[pagesId - 1] = Buffer.from(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`);
  const info = add(`<< /Title <${encoded(state.document.title)}> /Author (Impress) /Producer (Impress local tariff generator) >>`);
  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')]; const offsets = [0]; let offset = chunks[0].length;
  objects.forEach((body, index) => { offsets.push(offset); const item = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), body, Buffer.from('\nendobj\n')]); chunks.push(item); offset += item.length; });
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${info} 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
  return Buffer.concat(chunks);
}
