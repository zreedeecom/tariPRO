// Parity with the source Maestro workbook. Needs the private fixtures (real costs), never committed:
// TARIPRO_FIXTURES=<folder with initial.json, versions/initial.json and workbooks.json>
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {validate, priceRows, simulate, migrate} from '../app/model.mjs';
const folder=process.env.TARIPRO_FIXTURES;
const skip=folder?false:'sin TARIPRO_FIXTURES: tests de paridad con el Maestro omitidos';
const read=name=>JSON.parse(fs.readFileSync(path.join(folder,name)));
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const tariff=state=>state.materials.flatMap(m=>priceRows(state,m).flatMap(r=>[r.price,...r.tiers]));
function load(){
 const master=read('workbooks.json').find(item=>item.path.includes('Maestro'));
 const sheet=name=>master.sheets.find(item=>item.name===name).cells;
 const rows=[...Array.from({length:8},(_,i)=>10+i),...Array.from({length:8},(_,i)=>22+i),34,35,36,37,53,54,55,56,42,43,44,45];
 return {seed:read('initial.json'),legacy:read('versions/initial.json'),sheet,sourcePrices:rows.flatMap(row=>[...'CDEF'].map(col=>sheet('Tarifa profesional')[col+row].value))};
}
test('Initial catalog reproduces all 112 source prices as base + finish supplements, also migrated from v1',{skip},()=>{
 const {seed,legacy,sourcePrices}=load();
 assert.deepEqual(validate(seed),[]);const values=tariff(seed);assert.equal(values.length,112);sourcePrices.forEach((value,index)=>near(values[index],value));
 const migrated=migrate(legacy);assert.deepEqual(validate(migrated),[]);sourcePrices.forEach((value,index)=>near(tariff(migrated)[index],value));
});
test('14 original single-piece simulations reproduce 238 values',{skip},()=>{
 const {seed,sheet}=load(),input={materialId:'material-4',rollId:'roll-4'};
 for(const [start,width] of [[21,1],[33,1.3]]) for(let i=0;i<7;i++) {
  const row=start+i,length=sheet('Simulación')[`B${row}`].value;
  const a=simulate(seed,{...input,width,length,rowKey:'base'});
  const b=simulate(seed,{...input,width,length,rowKey:'lam-poly'});
  const values=[a.quantity,a.discount,a.consumed,a.waste,a.unitPrice,a.income,a.materialCost,a.inkCost+a.setupCost,a.cost,a.profit,a.margin,b.unitPrice,b.income,b.finishes[0].total,b.cost,b.profit,b.margin];
  [...'CDEFGHIJKLMNOPQRS'].forEach((col,j)=>near(values[j],sheet('Simulación')[col+row].value));
 }
});
