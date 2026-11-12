// Exercises the real UI handlers without claiming browser layout verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import * as model from '../app/model.mjs';
const source=fs.readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'');
const seed=JSON.parse(fs.readFileSync(new URL('./fixtures/sample-catalog.json',import.meta.url)));
async function harness(recovered=null,key='impress-tariff-draft-v2'){
 const elements=new Map(); const storage=new Map(); if(recovered)storage.set(key,JSON.stringify(recovered));
 const element=selector=>{if(!elements.has(selector))elements.set(selector,{dataset:{},value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,classList:{toggle(){}},setAttribute(){},removeAttribute(){},listeners:{},addEventListener(name,callback){this.listeners[name]=callback;},showModal(){this.open=true;},close(){this.open=false;},click(){},focus(){},checkValidity(){return true;}});return elements.get(selector);};
 const context=vm.createContext({...model,structuredClone,Intl,JSON,Number,Math,Set,Map,Date,Array,Blob,URL,crypto:webcrypto,console,setTimeout,clearTimeout,location:{hash:''},history:{replaceState(){}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},window:{addEventListener(){}},document:{querySelector:selector=>selector==='[aria-invalid="true"]'?null:element(selector),querySelectorAll:()=>[],addEventListener(){},createElement:()=>element('created'),getElementById:element},fetch:async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>structuredClone(seed)})});
 vm.runInContext(source+'\nglobalThis.ui={getDraft:()=>draft,setDraft:s=>{draft=s;selectedId=s.materials[0]?.id;},getBusy:()=>busy,assertValid,handleBinding,action,renderTariff,renderFinishes,renderSettings,renderSimulator,renderDocument,comparison};',context);
 await new Promise(resolve=>setImmediate(resolve));return {ui:context.ui,element,context,storage};
}
const input=(path,value)=>({dataset:{bind:path},value,tagName:'SELECT',setAttribute(){},removeAttribute(){},checkValidity(){return true;}});
test('Every primary UI template renders real catalog data without a runtime exception',async()=>{
 const {ui}=await harness();for(const name of ['renderTariff','renderFinishes','renderSettings','renderSimulator','renderDocument']){const html=ui[name]();assert.ok(html.length>500);assert.ok(!html.includes('[object Object]'));}
});
test('Switching the base price mode keeps the current price and derives the equivalent target',async()=>{
 const {ui}=await harness();
 ui.handleBinding(input('materials.0.pricing.mode','fixed'));let m=ui.getDraft().materials[0];assert.equal(m.pricing.mode,'fixed');assert.equal(m.price,15);
 ui.handleBinding(input('materials.0.pricing.mode','markup'));m=ui.getDraft().materials[0];assert.equal(model.basePrice(ui.getDraft(),m),15);
 ui.handleBinding(input('materials.0.pricing.mode','margin'));m=ui.getDraft().materials[0];assert.equal(model.basePrice(ui.getDraft(),m),15);
 assert.equal(model.priceRows(ui.getDraft(),m).map(r=>r.price).join(),'15,20,19,24');
});
test('Duplicating a material keeps its compatible finishes and supplements',async()=>{
 const {ui}=await harness();ui.getDraft().materials[2].supplements['lam-poly']=7;ui.setDraft(ui.getDraft());ui.getDraft();
 const state=ui.getDraft();state.materials.unshift(state.materials.splice(2,1)[0]);ui.setDraft(state);await ui.action('duplicate-material',{});
 const copy=ui.getDraft().materials.at(-1);assert.match(copy.name,/copia/);assert.ok(ui.getDraft().finishes.find(f=>f.id==='lam-poly').materialIds.includes(copy.id));
 assert.equal(model.priceRows(ui.getDraft(),copy).map(r=>r.price).join(),'16,21,23,28');assert.equal(model.validate(ui.getDraft()).length,0);
});
test('Dynamic material and finish creation produce a valid extensible catalog',async()=>{
 const {ui}=await harness();await ui.action('new-material',{});await ui.action('new-finish',{});const state=ui.getDraft();assert.equal(state.materials.length,9);assert.equal(state.finishes.length,6);assert.deepEqual(model.validate(state),[]);
});
test('Invalid numeric input preserves the last valid cost',async()=>{
 const {ui}=await harness();const target={...input('materials.0.cost','-5'),tagName:'INPUT',dataset:{bind:'materials.0.cost',number:'true'},checkValidity(){return false;}};ui.handleBinding(target);assert.equal(ui.getDraft().materials[0].cost,2.1);
});
test('Invalid pending inputs block context-changing actions and saving',async()=>{
 const {ui}=await harness();const target={...input('materials.0.cost',''),tagName:'INPUT',dataset:{bind:'materials.0.cost',number:'true'},checkValidity(){return false;}};ui.handleBinding(target);
 assert.throws(()=>ui.assertValid(),/Corrige el campo/);await assert.rejects(ui.action('new-material',{}),/Corrige el campo/);assert.equal(ui.getDraft().materials.length,8);
 target.value='2';target.checkValidity=()=>true;ui.handleBinding(target);assert.doesNotThrow(()=>ui.assertValid());
});
test('Recovering an earlier draft asks before replacing current edits; forgetting preserves new edits',async()=>{
 const recovered=structuredClone(seed);recovered.materials[0].cost=9;
 const {ui,element,storage}=await harness({baseRevision:'initial',state:recovered});
 const current=structuredClone(seed);current.materials[0].cost=3;ui.setDraft(current);
 const pending=element('#recover-draft').onclick();assert.equal(ui.getDraft().materials[0].cost,3);const dialog=element('#confirm-dialog');assert.equal(dialog.open,true);dialog.returnValue='cancel';dialog.listeners.close();await pending;assert.equal(ui.getDraft().materials[0].cost,3);
 element('#forget-draft').onclick();assert.equal(JSON.parse(storage.get('impress-tariff-draft-v2')).state.materials[0].cost,3);
});
test('An in-flight save blocks modal cancellation and editing until completion',async()=>{
 const {ui,element,context}=await harness();let finish;
 context.fetch=()=>new Promise(resolve=>{finish=resolve;});
 const pending=element('#save-form').listeners.submit({preventDefault(){}});assert.equal(ui.getBusy(),true);assert.equal(element('#main').inert,true);assert.equal(element('#save-dialog [data-close]').disabled,true);
 let prevented=false;element('#save-dialog').listeners.cancel({preventDefault(){prevented=true;}});assert.equal(prevented,true);
 finish({ok:true,headers:{get:()=> 'application/json'},json:async()=>structuredClone(seed)});await pending;assert.equal(ui.getBusy(),false);assert.equal(element('#main').inert,false);
});
test('A draft left in the v1 format is migrated before it can be recovered',async()=>{
 const legacy=JSON.parse(fs.readFileSync(new URL('./fixtures/sample-catalog-v1.json',import.meta.url)));legacy.materials[0].cost=9;
 const {ui,element}=await harness({baseRevision:'initial',state:legacy},'impress-tariff-draft-v1');
 await element('#recover-draft').onclick();const draft=ui.getDraft();assert.equal(draft.schemaVersion,2);assert.equal(draft.materials[0].cost,9);assert.equal(model.validate(draft).length,0);
});
