import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {CatalogStore,inspectDataDirectory} from '../app/store.mjs';
import {createHandler} from '../app/http.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function fixture(t){
 await fs.mkdir(path.join(root,'.qa'),{recursive:true});const dir=await fs.mkdtemp(path.join(root,'.qa/test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const store=new CatalogStore(dir,path.join(root,'tests/fixtures/sample-catalog.json'));await store.initialize();const exportsDirectory=path.join(dir,'exports');await fs.mkdir(exportsDirectory);
 const handler=createHandler({root,port:4173,store,exportsDirectory,logo:await fs.readFile(path.join(root,'public/assets/impress-logo.jpg'))});
 async function request(url,{method='GET',payload,headers={}}={}){const req=Readable.from(payload===undefined?[]:[Buffer.from(typeof payload==='string'?payload:JSON.stringify(payload))]);Object.assign(req,{url,method,headers:{host:'127.0.0.1:4173',...headers}});let status,responseHeaders,bytes;await handler(req,{writeHead(code,head){status=code;responseHeaders=head},end(data){bytes=Buffer.isBuffer(data)?data:Buffer.from(data)}});return {status,headers:responseHeaders,bytes,json(){return JSON.parse(bytes)}};}
 return {dir,store,request,exportsDirectory};
}
test('Snapshots survive restart, preserve previous data and reject stale writes',async t=>{
 const {dir,store}=await fixture(t);const first=await store.read();const changed=structuredClone(first);changed.materials[0].cost*=1.05;
 const next=await store.save(changed,'initial','Coste +5%');assert.equal(next.materials[0].price,15.22);assert.equal((await store.version('initial')).materials[0].price,15);
 const reopened=new CatalogStore(dir,path.join(root,'tests/fixtures/sample-catalog.json'));await reopened.initialize();assert.equal((await reopened.read()).revision,next.revision);
 await assert.rejects(store.save(changed,'initial','Stale'),error=>error.status===409&&error.code==='STALE');
});
test('The current revision is cheap to poll and a stale save answers STALE',async t=>{
 const {store,request}=await fixture(t);const state=await store.read();
 assert.deepEqual((await request('/api/revision')).json(),{revision:'initial',versionLabel:state.versionLabel,savedAt:state.savedAt});
 const next=await store.save(state,'initial','Desde otro ordenador');
 assert.deepEqual((await request('/api/revision')).json(),{revision:next.revision,versionLabel:'Desde otro ordenador',savedAt:next.savedAt});
 const stale=await request('/api/state',{method:'PUT',payload:{state,expectedRevision:'initial'}});assert.equal(stale.status,409);assert.equal(stale.json().code,'STALE');
});
test('Concurrent saves cannot overwrite each other',async t=>{const {store}=await fixture(t);const state=await store.read();const outcomes=await Promise.allSettled([store.save(state,'initial','A'),store.save(state,'initial','B')]);assert.equal(outcomes.filter(item=>item.status==='fulfilled').length,1);assert.equal(outcomes.filter(item=>item.status==='rejected').length,1);});
test('HTTP routes serve the app and protect internal project files',async t=>{
 const {request}=await fixture(t);assert.equal((await request('/')).status,200);assert.equal((await request('/model.mjs')).status,200);
 assert.equal((await request('/data/current.json')).status,404);assert.equal((await request('/original/anything')).status,404);
 assert.equal((await request('/api/state',{headers:{host:'attacker.example'}})).status,403);assert.equal((await request('/api/state',{headers:{origin:'https://attacker.example'}})).status,403);
});
test('API save, preview, export and history form a complete lifecycle',async t=>{
 const {request,exportsDirectory}=await fixture(t);const state=(await request('/api/state')).json();state.materials[0].cost*=1.05;
 const preview=await request('/api/preview',{method:'POST',payload:state});assert.equal(preview.status,200);assert.ok(preview.bytes.toString('ascii',0,8).startsWith('%PDF-'));
 assert.equal((await request('/api/history')).json().length,1);
 const saved=(await request('/api/state',{method:'PUT',payload:{state,expectedRevision:'initial',label:'Prueba'}})).json();assert.equal(saved.materials[0].price,15.22);
 const exported=(await request('/api/export',{method:'POST',payload:{revision:saved.revision}})).json();assert.ok(exported.file.endsWith('.pdf'));assert.equal((await request(exported.url)).status,200);
 await request('/api/export',{method:'POST',payload:{revision:'initial'}});assert.equal((await fs.readdir(exportsDirectory)).length,2);
 const again=(await request('/api/export',{method:'POST',payload:{revision:saved.revision}})).json();assert.notEqual(again.file,exported.file);assert.match(again.file,/-\d{8}-\d{6}(-\d+)?\.pdf$/);assert.equal((await fs.readdir(exportsDirectory)).length,3);
 assert.equal((await request('/api/history')).json().length,2);assert.equal((await request(`/api/version/${saved.revision}`)).json().versionLabel,'Prueba');
});
test('Invalid input never replaces a saved catalog',async t=>{
 const {request,store}=await fixture(t);const state=await store.read();state.materials[0].cost=-1;
 const response=await request('/api/state',{method:'PUT',payload:{state,expectedRevision:'initial'}});assert.equal(response.status,422);assert.equal((await store.read()).revision,'initial');
 assert.equal((await request('/api/state',{method:'PUT',payload:'{broken'})).status,400);
 assert.equal((await request('/api/version/..')).status,404);
});
test('Catalogs saved in the v1 format are read migrated and left untouched on disk',async t=>{
 const {dir,store,request}=await fixture(t);const legacy=await fs.readFile(path.join(root,'tests/fixtures/sample-catalog-v1.json'),'utf8');
 await fs.writeFile(path.join(dir,'current.json'),legacy);await fs.writeFile(path.join(dir,'versions','initial.json'),legacy);
 const reopened=new CatalogStore(dir,path.join(root,'tests/fixtures/sample-catalog.json'));await reopened.initialize();
 const state=(await request('/api/state')).json();assert.equal(state.schemaVersion,2);assert.equal(state.materials[0].price,15);
 assert.equal((await request('/api/version/initial')).json().schemaVersion,2);assert.equal(await fs.readFile(path.join(dir,'current.json'),'utf8'),legacy);
 const exported=await request('/api/export',{method:'POST',payload:{revision:'initial'}});assert.equal(exported.status,200);
});
test('Catalogs from a newer schema are refused and never overwritten',async t=>{
 const {dir,store,request}=await fixture(t);const state=await store.read();const newer=JSON.stringify({...state,schemaVersion:3},null,2);
 await fs.writeFile(path.join(dir,'current.json'),newer);
 const reopened=new CatalogStore(dir,path.join(root,'tests/fixtures/sample-catalog.json'));await assert.rejects(reopened.initialize(),error=>error.code==='NEWER_DATA');
 await assert.rejects(store.save(state,'initial','Old app'),error=>error.code==='NEWER_DATA');
 const refused=await request('/api/state');assert.equal(refused.status,409);assert.equal(refused.json().code,'NEWER_DATA');assert.equal(await fs.readFile(path.join(dir,'current.json'),'utf8'),newer);
});
test('Each saved version records the app version that wrote it',async t=>{
 const {dir,store}=await fixture(t);const {version}=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
 const next=await store.save(await store.read(),'initial','Con versión');assert.equal(next.savedWith,version);
 assert.equal(JSON.parse(await fs.readFile(path.join(dir,'versions',`${next.revision}.json`),'utf8')).savedWith,version);
 assert.equal((await store.save(next,next.revision,'Otra')).savedWith,version);
});
test('Conflicted copies from Dropbox and pCloud are listed and do not break the history',async t=>{
 const {dir,store,request}=await fixture(t);assert.deepEqual(await store.conflicts(),[]);
 const names=['current (Luis\'s conflicted copy 2026-11-12).json',path.join('versions','initial (copia en conflicto de Luis 2026-11-12).json'),path.join('exports','tarifa [conflicted].pdf')];
 for(const name of names)await fs.writeFile(path.join(dir,name),'{}');await fs.writeFile(path.join(dir,'notas.txt'),'');
 assert.deepEqual(await store.conflicts(),[...names].sort());
 const history=(await request('/api/history')).json();assert.deepEqual(history.map(item=>item.id),['initial']);
});
test('A folder with saved versions but no current.json is left untouched',async t=>{
 const {dir,store}=await fixture(t);assert.equal(await inspectDataDirectory(dir),'ready');
 await fs.rm(path.join(dir,'current.json'));const before=await fs.readdir(dir,{recursive:true});
 assert.equal(await inspectDataDirectory(dir),'incomplete');
 const reopened=new CatalogStore(dir,path.join(root,'tests/fixtures/sample-catalog.json'));await assert.rejects(reopened.initialize(),error=>error.code==='INCOMPLETE_DATA');
 assert.deepEqual(await fs.readdir(dir,{recursive:true}),before);
 const empty=path.join(dir,'empty');assert.equal(await inspectDataDirectory(empty),'empty');await fs.mkdir(path.join(empty,'versions'),{recursive:true});assert.equal(await inspectDataDirectory(empty),'empty');
});
test('Deleting a version moves it untouched to papelera/ and never the current one',async t=>{
 const {dir,store,request,exportsDirectory}=await fixture(t);const state=await store.read();
 const first=await store.save(state,'initial','Primera');const second=await store.save(state,first.revision,'Segunda');
 await request('/api/export',{method:'POST',payload:{revision:first.revision}});
 const read=file=>fs.readFile(path.join(dir,file),'utf8');const original=await read(`versions/${first.revision}.json`),current=await read('current.json');
 assert.equal((await request(`/api/version/${first.revision}`,{method:'DELETE'})).status,200);
 assert.equal(await read(`papelera/${first.revision}.json`),original);assert.equal(await read('current.json'),current);
 assert.deepEqual((await request('/api/history')).json().map(item=>item.id),[second.revision,'initial']);assert.equal((await fs.readdir(exportsDirectory)).length,1);
 const again=await request(`/api/version/${first.revision}`,{method:'DELETE'});assert.equal(again.status,404);assert.match(again.json().error,/ya no existe/);
 const vigente=await request(`/api/version/${second.revision}`,{method:'DELETE'});assert.equal(vigente.status,409);await read(`versions/${second.revision}.json`);
 assert.equal((await request('/api/version/..%2Fcurrent',{method:'DELETE'})).status,400);
 const deleted=await request(`/api/version/${first.revision}`);assert.equal(deleted.status,200,'a deleted version is still readable as a merge base');assert.equal(deleted.json().versionLabel,'Primera');
 assert.equal((await request('/api/version/missing')).status,404);assert.equal(vigente.json().code,undefined);
});
