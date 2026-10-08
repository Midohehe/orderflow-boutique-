// Real fingerprint/attempt modules, with local storage and network failures isolated.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const crypto=require('node:crypto').webcrypto,storage=new Map();let unavailable=false;
let timeoutCallback,clears=0;
const globals={crypto,TextEncoder,Date,AbortController,setTimeout:fn=>{timeoutCallback=fn;return 1},clearTimeout:()=>clears++,sessionStorage:{getItem:k=>{if(unavailable)throw Error('disabled');return storage.get(k)||null},setItem:(k,v)=>{if(unavailable)throw Error('disabled');storage.set(k,v)},removeItem:k=>storage.delete(k)}};
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{...globals,module,exports:module.exports,require:name=>load(path.resolve(path.dirname(file),name+'.ts'))});return module.exports;}
(async()=>{const {createCheckoutAttempt}=load(path.resolve(__dirname,'../src/lib/checkoutAttempt.ts'));
 const payload={product_id:'one',phone:'0910000000',quantity:2,city:'Tripoli',items:[{quantity:2,color:'red'}]};
 const first=createCheckoutAttempt(),id=await first.requestId(payload);assert.match(id,/^[0-9a-f-]{36}$/);assert.equal(await first.requestId(payload),id);
 assert.equal(await createCheckoutAttempt().requestId({...payload,utm_source:'changed',client_ip:'different'}),id,'Reload and attribution changes must reuse uncertain checkout');
 assert.notEqual(await createCheckoutAttempt().requestId({...payload,quantity:3}),id,'Customer edits get a distinct request');
 first.acknowledge();assert.equal(await first.requestId(payload),id,'Repeated event on same completed form cannot create another order');assert.notEqual(await createCheckoutAttempt().requestId(payload),id,'A new purchase after acknowledged success is allowed');
 unavailable=true;const privateMode=createCheckoutAttempt(),privateId=await privateMode.requestId(payload);assert.equal(await privateMode.requestId(payload),privateId);
 for(const raw of storage.values())assert.ok(!raw.includes(payload.phone),'Do not store customer data in retry receipts');
 globals.crypto={subtle:crypto.subtle,getRandomValues:crypto.getRandomValues.bind(crypto)};
 const legacy=load(path.resolve(__dirname,'../src/lib/checkoutAttempt.ts'));assert.match(await legacy.createCheckoutAttempt().requestId(payload),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 assert.equal(await legacy.withCheckoutTimeout(async()=>42),42);assert.equal(clears,1);
 const timed=legacy.withCheckoutTimeout(signal=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout')))));timeoutCallback();await assert.rejects(timed,/timeout/);assert.equal(clears,2);
 console.log('PASS checkout retry IDs: uncertain reload, repeated events, changed input, acknowledged new purchase, unavailable storage, no customer data persisted; older-browser UUID and timeout cancellation/cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1});
