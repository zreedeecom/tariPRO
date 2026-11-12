import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {clone, validate, priceRows, basePrice, materialize, simulate, discountFor, migrate, materialRows, suggestedSupplement} from '../app/model.mjs';
const seed=JSON.parse(fs.readFileSync(new URL('./fixtures/sample-catalog.json',import.meta.url)));
const legacy=JSON.parse(fs.readFileSync(new URL('./fixtures/sample-catalog-v1.json',import.meta.url)));
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const tariff=state=>state.materials.flatMap(m=>priceRows(state,m).flatMap(r=>[r.price,...r.tiers]));
test('v1 catalogs migrate to the same rows, labels and prices',()=>{
 assert.deepEqual(validate(seed),[]);assert.equal(tariff(seed).length,112);
 assert.equal(validate(legacy)[0],'El archivo no tiene el formato de catálogo esperado.');
 const migrated=migrate(legacy);assert.deepEqual(validate(migrated),[]);assert.deepEqual(tariff(migrated),tariff(seed));
 const rows=state=>state.materials.flatMap(m=>priceRows(state,m).map(r=>[r.key,r.label,r.price]));assert.deepEqual(rows(migrated),rows(seed));
 assert.equal(migrate(seed),seed);
});
test('v1 per-material supplement differences become overrides and missing combinations become hidden rows',()=>{
 const state=clone(legacy),m=state.materials[2];m.options.find(o=>o.id==='material-3-finished').price=23;m.options=m.options.filter(o=>o.id!=='material-3-base-cut');
 const migrated=migrate(state),mm=migrated.materials[2];assert.equal(mm.supplements['lam-poly'],7);assert.deepEqual(mm.hiddenRows,['die-cut']);
 assert.deepEqual(priceRows(migrated,mm).map(r=>[r.label,r.price]),[['Sin laminado',16],['Con laminado',23],['Con laminado + troquelado',27]]);
});
test('Rows combine no/one laminate with each process finish; laminates never stack',()=>{
 const state=clone(seed);state.finishes[1].materialIds.push('material-1');
 assert.deepEqual(materialRows(state,state.materials[0]).map(r=>r.label),['Sin laminado','Sin laminado + troquelado','Con Oracal 200M','Con Oracal 200M + troquelado','Con Oracal 215M','Con Oracal 215M + troquelado']);
 assert.deepEqual(materialRows(seed,seed.materials[6]).map(r=>r.label),['Sin acabado','Con ollados']);
});
test('Material override replaces the finish supplement only for that material',()=>{
 const state=clone(seed);state.materials[2].supplements['lam-poly']=7;
 assert.equal(priceRows(state,state.materials[2])[2].price,23);assert.equal(priceRows(state,state.materials[3])[2].price,24);
});
test('Hidden rows leave the tariff but stay available to the simulator',()=>{
 const state=clone(seed),m=state.materials[0];m.hiddenRows=['die-cut+lam-mono'];
 assert.equal(priceRows(state,m).length,3);assert.equal(priceRows(state,m,{includeHidden:true}).length,4);
 assert.ok(simulate(state,{materialId:'material-1',rowKey:'die-cut+lam-mono',width:1,length:1,rollId:'roll-1'}).unitPrice>0);
 m.hiddenRows=priceRows(state,m,{includeHidden:true}).map(r=>r.key);assert.ok(validate(state).some(message=>message.includes('al menos una fila')));
});
test('A 5% material cost rise moves the base price and keeps every finish supplement',()=>{
 const state=clone(seed),m=state.materials[0];m.cost*=1.05;
 const rows=priceRows(state,m);assert.deepEqual(rows.map(r=>r.price),[15.22,20.22,19.22,24.22]);assert.equal(seed.materials[0].price,15);
 assert.equal(materialize(state).materials[0].price,15.22);
});
test('Fixed price absorbs costs; markup and margin are different policies',()=>{
 const state=clone(seed),m=state.materials[0];m.cost=10;m.inkCost=0;state.settings.setupCost=0;
 m.pricing={mode:'margin',value:.4};near(basePrice(state,m),16.67);
 m.pricing={mode:'markup',value:.4};near(basePrice(state,m),14);
 m.pricing={mode:'fixed',value:0};m.price=15;near(basePrice(state,m),15);
});
test('A finish cost change keeps the supplement and only suggests a margin-preserving one',()=>{
 const state=clone(seed),finish=state.finishes[1];finish.cost=3.5;
 assert.equal(priceRows(state,state.materials[2])[2].price,22);
 near(suggestedSupplement(seed,finish),6.18);assert.equal(suggestedSupplement(seed,seed.finishes[1]),null);assert.equal(suggestedSupplement(seed,state.finishes[3]),null);
});
test('Unknown finish costs keep the price but leave the margin pending',()=>{
 const row=priceRows(seed,seed.materials[6])[1];assert.equal(row.price,20);assert.equal(row.margin,null);assert.deepEqual(row.cost.missing,['Ollados y corte a medida']);
});
test('Laminate roll costs and compatible widths are honored',()=>{
 const state=clone(seed);state.finishes[1].rolls[0].cost=10;
 let result=simulate(state,{materialId:'material-4',rowKey:'lam-poly',width:1,length:1,rollId:'roll-4'});near(result.finishes[0].total,10);
 state.finishes[1].rolls[0].width=1.5;
 assert.throws(()=>simulate(state,{materialId:'material-4',rowKey:'lam-poly',width:1,length:1,rollId:'roll-4'}),/No hay bobina/);
});
test('Material roll override affects simulation without changing the general tariff',()=>{
 const state=clone(seed);state.materials[0].rolls[0].cost=2;
 const result=simulate(state,{materialId:'material-1',rowKey:'base',width:1,length:1,rollId:'roll-1'});
 near(result.materialCost,3.425);assert.equal(priceRows(state,state.materials[0])[0].price,15);
});
test('Several roll widths per material are selectable in the simulator',()=>{
 const state=clone(seed);state.materials[0].rolls.push({id:'roll-1-152',width:1.52,cost:null});state.finishes[0].rolls.push({id:'roll-lam-152',width:1.52,cost:null});
 assert.deepEqual(validate(state),[]);
 const wide=simulate(state,{materialId:'material-1',rowKey:'lam-mono',width:1.5,length:1,rollId:'roll-1-152'});near(wide.consumed,1.52*1.25);
});
test('Rejects oversized pieces and invalid dimensions',()=>{
 const input={materialId:'material-4',rowKey:'base',rollId:'roll-4',width:2,length:1};
 assert.throws(()=>simulate(seed,input),/no cabe/);assert.throws(()=>simulate(seed,{...input,width:NaN}),/válidos/);assert.throws(()=>simulate(seed,{...input,width:1,length:Infinity}),/válidos/);
});
test('Custom paper, units and finishes need no special product code',()=>{
 const state=clone(seed);state.finishes.push({id:'fold',name:'Plegado',kind:'process',label:'plegado',cost:.1,supplement:.2,materialIds:['paper'],rolls:[]});
 const m={id:'paper',name:'Papel 150 g',category:'Papeles',description:'Impresión en papel',supplier:'',unit:'unit',active:true,cost:.2,inkCost:.05,referenceQty:100,rolls:[],pricing:{mode:'margin',value:.5},price:0,supplements:{},hiddenRows:[]};state.materials.push(m);
 assert.deepEqual(validate(state),[]);assert.deepEqual(priceRows(state,m).map(r=>[r.label,r.price]),[['Sin acabado',.53],['Con plegado',.73]]);
 const result=simulate(state,{materialId:'paper',rowKey:'fold',quantity:100});near(result.cost,36.5);near(result.income,62.05);near(result.waste,0);
});
test('Missing eyelet cost makes a simulation partial',()=>{
 const result=simulate(seed,{materialId:'material-7',rowKey:'eyelets',width:1,length:1,rollId:'roll-7'});assert.equal(result.complete,false);assert.equal(result.finishes[0].total,null);
});
test('Discount thresholds include the boundary without grouping orders',()=>{ for(const [quantity,rate] of [[4.99,0],[5,.05],[10,.1],[25,.15]])near(discountFor(seed,quantity),rate); });
test('Validation catches duplicate IDs, negative costs, invalid margins and orphan supplements',()=>{
 const state=clone(seed);state.materials[0].cost=-1;state.materials[0].pricing={mode:'margin',value:1};state.materials[1].id=state.materials[0].id;state.materials[6].supplements['lam-mono']=3;state.finishes[0].materialIds.push('missing');
 const errors=validate(state);assert.ok(errors.length>=4);assert.ok(errors.some(message=>message.includes('no compatible')));assert.ok(errors.some(message=>message.includes('materiales compatibles')));
});
test('Zero selling price is valid and has no percentage margin',()=>{ const state=clone(seed),m=state.materials[6];m.pricing={mode:'fixed',value:0};m.price=0;assert.equal(priceRows(state,m)[0].margin,null); });
test('Grouped families require a single sale unit and catalogs without optional document fields stay valid',()=>{
 const state=clone(seed);state.materials[7].unit='unit';assert.ok(validate(state).some(message=>message.includes('misma unidad')));
 const bare=clone(seed);delete bare.document.groups;delete bare.document.subtitle;bare.materials.forEach(m=>delete m.tagline);assert.deepEqual(validate(bare),[]);
});
