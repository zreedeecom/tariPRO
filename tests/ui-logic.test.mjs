// Exercises the real UI handlers without claiming browser layout verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import * as model from '../app/model.mjs';
import * as merge from '../app/merge.mjs';
const source=fs.readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');
const seed=JSON.parse(fs.readFileSync(new URL('./fixtures/sample-catalog.json',import.meta.url)));
async function harness(recovered=null,key='impress-tariff-draft-v2',initial=seed){
 const elements=new Map(); const storage=new Map(); if(recovered)storage.set(key,JSON.stringify(recovered));
 const element=selector=>{if(!elements.has(selector))elements.set(selector,{dataset:{},value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,classList:{toggle(){}},setAttribute(){},removeAttribute(){},listeners:{},addEventListener(name,callback){this.listeners[name]=callback;},showModal(){this.open=true;},close(){this.open=false;},click(){},focus(){},querySelectorAll(){return [];},checkValidity(){return true;}});return elements.get(selector);};
 const context=vm.createContext({...model,...merge,setInterval(){},structuredClone,Intl,JSON,Number,Math,Set,Map,Date,Array,Blob,URL,crypto:webcrypto,console,setTimeout,clearTimeout,location:{hash:''},history:{replaceState(){}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},window:{addEventListener(){}},document:{visibilityState:'visible',querySelector:selector=>['[aria-invalid="true"]','dialog[open]'].includes(selector)?null:element(selector),querySelectorAll:()=>[],addEventListener(){},createElement:()=>element('created'),getElementById:element},fetch:async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>structuredClone(initial)})});
 vm.runInContext(source+'\nglobalThis.ui={getDraft:()=>draft,getSaved:()=>saved,getMerging:()=>merging,checkRemote,setDraft:s=>{draft=s;selectedId=s.materials[0]?.id;},getBusy:()=>busy,assertValid,handleBinding,action,renderTariff,renderFinishes,renderSettings,renderSimulator,renderDocument,comparison};',context);
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

// Another computer saves while this one is open: GET /api/revision and /api/state answer with their version.
const json=data=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>structuredClone(data)});
function serve(context,routes){context.fetch=async(url,options={})=>{const route=routes[`${options.method||'GET'} ${url}`];if(!route)throw new Error(`Unexpected ${url}`);return typeof route==='function'?route(options):json(route);};}
const theirsWith=(change,label='Desde el otro Mac')=>{const state=structuredClone(seed);change(state);return {...state,revision:'rev-theirs',versionLabel:label};};
test('A version saved elsewhere loads by itself when there is no draft',async()=>{
 const {ui,context,element}=await harness();const theirs=theirsWith(s=>{s.materials[1].cost=4;});
 serve(context,{'GET /api/revision':{revision:'rev-theirs'},'GET /api/state':theirs});await ui.checkRemote();
 assert.equal(ui.getSaved().revision,'rev-theirs');assert.equal(ui.getDraft().materials[1].cost,4);assert.equal(JSON.stringify(ui.getDraft()),JSON.stringify(ui.getSaved()));
 assert.match(element('#toast').textContent,/Se ha cargado «Desde el otro Mac»/);
});
test('Without conflicts their changes come into the draft and mine stay',async()=>{
 const {ui,context,element,storage}=await harness();const draft=ui.getDraft();draft.materials[0].cost=3;ui.setDraft(draft);
 const theirs=theirsWith(s=>{s.materials[1].cost=4;s.materials.push({...structuredClone(s.materials[0]),id:'material-new',name:'Nuevo suyo',rolls:[]});});
 serve(context,{'GET /api/revision':{revision:'rev-theirs'},'GET /api/state':theirs});await ui.checkRemote();
 assert.equal(ui.getSaved().revision,'rev-theirs');assert.deepEqual([ui.getDraft().materials[0].cost,ui.getDraft().materials[1].cost,ui.getDraft().materials.at(-1).name],[3,4,'Nuevo suyo']);
 assert.equal(element('#toast').textContent,'Entran 1 material nuevo y 1 cambio de «Desde el otro Mac», guardada desde otro ordenador. Tus cambios siguen en el borrador.');
 assert.equal(JSON.parse(storage.get('impress-tariff-draft-v2')).baseRevision,'rev-theirs');
});
test('A conflict asks with a banner and keeps the draft untouched until resolved',async()=>{
 const {ui,context,element}=await harness();const draft=ui.getDraft();draft.materials[0].cost=3;ui.setDraft(draft);
 const theirs=theirsWith(s=>{s.materials[0].cost=4;s.materials[1].cost=5;});
 serve(context,{'GET /api/revision':{revision:'rev-theirs'},'GET /api/state':theirs});await ui.checkRemote();
 assert.equal(ui.getSaved().revision,'initial');assert.equal(ui.getDraft().materials[0].cost,3);assert.equal(element('#remote-banner').hidden,false);assert.match(element('#remote-banner').innerHTML,/choca con tu borrador/);
 element('#remote-resolve').onclick();assert.equal(element('#merge-dialog').open,true);assert.match(element('#merge-list').innerHTML,/Lo suyo<\/strong> 4 €/);
 ui.getMerging().choices['material:material-1:cost']='theirs';element('#merge-form').listeners.submit({preventDefault(){}});
 assert.equal(ui.getSaved().revision,'rev-theirs');assert.deepEqual([ui.getDraft().materials[0].cost,ui.getDraft().materials[1].cost],[4,5]);assert.equal(element('#remote-banner').hidden,true);
});
test('«Más tarde» stops asking for that version, not for a newer one',async()=>{
 const {ui,context,element}=await harness();const draft=ui.getDraft();draft.materials[0].cost=3;ui.setDraft(draft);
 let state=theirsWith(s=>{s.materials[0].cost=4;});let reads=0;
 serve(context,{'GET /api/revision':()=>json({revision:state.revision}),'GET /api/state':()=>{reads++;return json(state);}});
 await ui.checkRemote();element('#remote-later').onclick();assert.equal(element('#remote-banner').hidden,true);
 await ui.checkRemote();assert.equal(reads,1);assert.equal(element('#remote-banner').hidden,true);
 state={...state,revision:'rev-newer'};await ui.checkRemote();assert.equal(reads,2);assert.equal(element('#remote-banner').hidden,false);
});
test('Checks never touch the draft while typing or when the folder cannot be read',async()=>{
 const {ui,context,element}=await harness();const theirs=theirsWith(s=>{s.materials[1].cost=4;});
 serve(context,{'GET /api/revision':{revision:'rev-theirs'},'GET /api/state':theirs});
 context.document.activeElement={matches:()=>true};await ui.checkRemote();assert.equal(ui.getSaved().revision,'initial');
 context.document.activeElement=null;context.fetch=async()=>{throw new Error('ENOENT');};await ui.checkRemote();assert.equal(ui.getSaved().revision,'initial');assert.equal(element('#error-banner').textContent,'');
});
test('Saving after someone else saved brings their version in instead of failing',async()=>{
 const {ui,context,element}=await harness();const draft=ui.getDraft();draft.materials[0].cost=3;ui.setDraft(draft);
 const theirs=theirsWith(s=>{s.materials[1].cost=4;});
 serve(context,{'PUT /api/state':()=>({ok:false,status:409,json:async()=>({error:'Stale',code:'STALE'})}),'GET /api/revision':{revision:'rev-theirs'},'GET /api/state':theirs});
 await element('#save-form').listeners.submit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ui.getSaved().revision,'rev-theirs');assert.deepEqual([ui.getDraft().materials[0].cost,ui.getDraft().materials[1].cost],[3,4]);
 assert.match(element('#toast').textContent,/Revisa y vuelve a guardar/);assert.equal(element('#error-banner').textContent,'');
});
test('A recovered draft made on an older version is merged with the current one',async()=>{
 const base=structuredClone(seed);const recovered=structuredClone(seed);recovered.materials[0].cost=9;
 const current=theirsWith(s=>{s.materials[1].cost=4;});
 const {ui,context,element}=await harness({baseRevision:'initial',state:recovered},undefined,current);
 serve(context,{'GET /api/version/initial':base});
 assert.match(element('#recovery-banner').innerHTML,/Recuperar e incorporar/);
 await element('#recover-draft').onclick();
 assert.deepEqual([ui.getDraft().materials[0].cost,ui.getDraft().materials[1].cost],[9,4]);assert.equal(ui.getSaved().revision,'rev-theirs');
});
test('A recovered draft whose starting version is gone asks for every difference',async()=>{
 const recovered=structuredClone(seed);recovered.materials[0].cost=9;const current=theirsWith(s=>{s.materials[1].cost=4;});
 const {ui,context,element}=await harness({baseRevision:'deleted-for-good',state:recovered},undefined,current);
 serve(context,{'GET /api/version/deleted-for-good':()=>({ok:false,status:404,json:async()=>({error:'No se encuentra.'})})});
 await element('#recover-draft').onclick();assert.equal(element('#merge-dialog').open,true);
 assert.deepEqual(ui.getMerging() && ui.getDraft().materials[0].cost,2.1,'nothing changes until applied');
 element('#merge-form').listeners.submit({preventDefault(){}});
 assert.deepEqual([ui.getDraft().materials[0].cost,ui.getDraft().materials[1].cost],[9,seed.materials[1].cost],'mine wins by default');assert.equal(element('#recovery-banner').hidden,true);
});
test('A version loaded from elsewhere keeps a pending draft from an earlier session',async()=>{
 const recovered=structuredClone(seed);recovered.materials[0].cost=9;
 const {ui,context,element,storage}=await harness({baseRevision:'initial',state:recovered});
 const theirs=theirsWith(s=>{s.materials[1].cost=4;});
 serve(context,{'GET /api/revision':{revision:'rev-theirs'},'GET /api/state':theirs,'GET /api/version/initial':seed});await ui.checkRemote();
 assert.equal(ui.getSaved().revision,'rev-theirs');assert.equal(JSON.parse(storage.get('impress-tariff-draft-v2')).state.materials[0].cost,9);assert.equal(element('#recovery-banner').hidden,false);
 await element('#recover-draft').onclick();
 assert.deepEqual([ui.getDraft().materials[0].cost,ui.getDraft().materials[1].cost],[9,4]);assert.equal(JSON.parse(storage.get('impress-tariff-draft-v2')).baseRevision,'rev-theirs');
});
test('Forgetting a pending draft with no changes in this session clears it from storage',async()=>{
 const recovered=structuredClone(seed);recovered.materials[0].cost=9;
 const {element,storage}=await harness({baseRevision:'initial',state:recovered});
 element('#forget-draft').onclick();assert.equal(storage.has('impress-tariff-draft-v2'),false);
});
