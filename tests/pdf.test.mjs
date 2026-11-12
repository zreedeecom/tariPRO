import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {inflateSync} from 'node:zlib';import {generatePdf} from '../app/pdf.mjs';
const seed=JSON.parse(fs.readFileSync(new URL('./fixtures/sample-catalog.json',import.meta.url)));const logo=fs.readFileSync(new URL('../public/assets/impress-logo.jpg',import.meta.url));
function content(pdf){const source=pdf.toString('binary');const streams=[...source.matchAll(/<< \/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/g)];return streams.map(match=>inflateSync(pdf.subarray(match.index+match[0].length,match.index+match[0].length+Number(match[1]))).toString()).join('\n');}
test('PDF has five A4 pages, correct xref and only public data',()=>{
 const pdf=generatePdf(seed,logo),source=pdf.toString('binary');assert.equal((source.match(/\/Type \/Page /g)||[]).length,5);assert.equal((source.match(/\/MediaBox \[0 0 595.2756 841.8898\]/g)||[]).length,5);
 const offset=Number(source.match(/startxref\n(\d+)/)[1]);assert.equal(source.slice(offset,offset+4),'xref');
 const commands=content(pdf);assert.ok(commands.includes(Buffer.from('LX Hausys LG2810G').toString('hex')));assert.ok(!commands.includes(Buffer.from('Proveedor A').toString('hex')));assert.ok(!commands.includes(Buffer.from('Margen').toString('hex')));
 assert.ok(commands.includes(Buffer.from('Laminado incluido').toString('hex')));assert.ok(!commands.includes(Buffer.from('>=').toString('hex')));assert.ok(!commands.includes(Buffer.from(' / ud.').toString('hex')));
});
test('Long custom materials and 48 generated rows paginate without clipping or looping',()=>{
 const state=structuredClone(seed),m=structuredClone(state.materials[0]);m.name='Material personalizado '.repeat(4);m.description='Descripción extensa para comprobar el salto de líneas. '.repeat(5);state.materials=[m];state.document.groups=[];
 state.finishes=[...Array.from({length:4},(_,index)=>({id:`p${index}`,name:`Proceso ${index}`,kind:'process',label:`acabado${index} `+'texto largo '.repeat(3),cost:1,supplement:2,materialIds:[m.id],rolls:[]})),...Array.from({length:2},(_,index)=>({id:`l${index}`,name:`Laminado ${index}`,kind:'laminate',label:'',cost:1,supplement:3,materialIds:[m.id],rolls:[]}))];
 const pdf=generatePdf(state,logo);const commands=content(pdf);for(let index=0;index<4;index++)assert.ok(commands.includes(Buffer.from(`acabado${index}`).toString('hex')));assert.ok(commands.includes(Buffer.from('Con Laminado 1 + acabado0').toString('hex')));assert.ok((pdf.toString('binary').match(/\/Type \/Page /g)||[]).length>1);
});
test('Archived materials are excluded and extended commercial notes flow across pages',()=>{
 const state=structuredClone(seed);state.materials.forEach(m=>m.active=false);state.document.notes=Array.from({length:20},(_,i)=>`Condición ${i}. `+'Texto explicativo. '.repeat(20));
 const commands=content(generatePdf(state,logo));assert.ok(!commands.includes(Buffer.from('LX Hausys').toString('hex')));assert.ok(commands.includes(Buffer.from('Condici','latin1').toString('hex')));
});
test('Unsupported public characters produce an explicit error',()=>{const state=structuredClone(seed);state.document.title='Tarifa 📄';assert.throws(()=>generatePdf(state,logo),/no admite/);});
test('Taglines, header subtitle and grouped families follow the reference layout',()=>{
 const commands=content(generatePdf(seed,logo)),hex=value=>Buffer.from(value,'latin1').toString('hex');
 for(const value of ['Duración media · trabajos estándar','Profesionales · Precios en ','Lona Frontlit · Sin acabado','Lona Microperforada · Con ollados','Frontlit y microperforada'])assert.ok(commands.includes(hex(value)),value);
 const ungrouped=structuredClone(seed);ungrouped.document.groups=[];assert.ok(!content(generatePdf(ungrouped,logo)).includes(hex('Lona Frontlit · Sin acabado')));
});
