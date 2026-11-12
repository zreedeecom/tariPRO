import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startServer} from '../app/server.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const freePort=()=>new Promise((resolve,reject)=>{const probe=net.createServer().once('error',reject).listen(0,'127.0.0.1',()=>{const {port}=probe.address();probe.close(()=>resolve(port));});});
test('startServer serves the app from the given folders and reports a busy port',async t=>{
 await fs.mkdir(path.join(root,'.qa'),{recursive:true});const dir=await fs.mkdtemp(path.join(root,'.qa/test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const port=await freePort();const options={dataDirectory:path.join(dir,'data'),exportsDirectory:path.join(dir,'exports'),port};
 const {server}=await startServer(options);t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status,200);
 const state=await (await fetch(`http://127.0.0.1:${port}/api/state`)).json();assert.equal(state.revision,'initial');
 await fs.access(path.join(dir,'data/current.json'));await fs.access(path.join(dir,'exports'));
 await assert.rejects(startServer(options),error=>error.code==='EADDRINUSE');
});
