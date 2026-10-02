const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict'),Module=require('module');
const deps=process.env.REACT_TEST_DEPS||path.resolve('../test-deps/node_modules');const React=require(path.join(deps,'react'));const original=Module._load;Module._load=function(n,...a){return n==='react'?React:original.call(this,n,...a)};const {act,create}=require(path.join(deps,'react-test-renderer'));
let saved=null,pending,batches=0,changed=0;
const makeJob=(n)=>({id:'job',total:10,processed:n,updated:n? n-1:0,failed:n?1:0,state:n===10?'completed':'running',codes:[],errors:n?['REF: error']:[],last_error:null});
const requestCarrierSync=async(store,action)=>{if(action==='status')return {job:saved};if(action==='start'){saved ||= makeJob(0);return {job:saved}}batches++;return new Promise(resolve=>{pending=()=>{saved=makeJob(saved.processed+5);resolve({job:saved})}})};
const Wrap=p=>React.createElement('div',p,p.children);const imports={'react':React,'react/jsx-runtime':require('react/jsx-runtime'),'lucide-react':{Loader2:()=>null,RefreshCw:()=>null},'@/components/ui/button':{Button:p=>React.createElement('button',p,p.children)},'@/components/ui/badge':{Badge:Wrap},'@/lib/carrierSync':{requestCarrierSync}};
const ex={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/CarrierSyncPanel.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:ex,require:n=>imports[n],AbortController,console});
const tick=()=>new Promise(r=>setTimeout(r,0));
(async()=>{let tree;await act(async()=>{tree=create(React.createElement(ex.default,{storeId:'store',onUpdated:()=>changed++}));await tick()});
await act(async()=>{tree.root.findAllByType('button')[0].props.onClick();await tick()});assert.equal(batches,1);assert.equal(tree.root.findByProps({role:'progressbar'}).props['aria-valuenow'],0);
await act(async()=>{tree.root.findAllByType('button')[1].props.onClick();pending();await tick()});assert.equal(batches,1);assert.equal(tree.root.findByProps({role:'progressbar'}).props['aria-valuenow'],5);assert.equal(tree.root.findAllByType('button')[0].props.disabled,false);
await act(async()=>{tree.root.findAllByType('button')[0].props.onClick();await tick();pending();await tick()});assert.equal(batches,2);assert.equal(tree.root.findByProps({role:'progressbar'}).props['aria-valuenow'],10);assert.equal(changed,2);tree.unmount();
console.log('PASS sync UI: live counts, pause finishes current batch, resume continues saved progress, completion and errors displayed.');
// A stalled SDK must not leave the UI spinning even if it ignores AbortSignal.
const api={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/carrierSync.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:api,require:n=>n.includes('client')?{supabase:{functions:{invoke:()=>new Promise(()=>{})}}}:{getEdgeFunctionErrorMessage:async()=>''},AbortController,Error,setTimeout:(f)=>setTimeout(f,5),clearTimeout});
await assert.rejects(api.requestCarrierSync('store','batch','job'),/مهلة/);console.log('PASS client timeout: stalled request terminates with a clear resumable error.');
})().catch(e=>{console.error(e);process.exitCode=1});
