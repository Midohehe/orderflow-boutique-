const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ts=require('typescript');
const assert=require('node:assert/strict');
const Module=require('module');
const deps=process.env.REACT_TEST_DEPS || path.resolve('../test-deps/node_modules');
const React=require(path.join(deps,'react'));
const originalLoad=Module._load;
Module._load=function(name,...args){if(name==='react') return React; return originalLoad.call(this,name,...args);};
const {create,act}=require(path.join(deps,'react-test-renderer'));
const {QueryClient,QueryClientProvider}=require('@tanstack/react-query');
function load(file,imports){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:out,require:name=>imports[name],console,Set,AbortController});return out;}
let user={id:'owner',app_metadata:{}};
let requests=[];
let member=null;
const supabase={from:table=>builder(table),rpc:name=>builder(name)};
function builder(table){let filters={};const b={select:()=>b,eq:(k,v)=>{filters[k]=v;return b},abortSignal:()=>b,maybeSingle:()=>b,then:(resolve,reject)=>{requests.push({table,filters});let data=table==='profiles'?{user_id:filters.user_id,is_active:true}:table==='has_role'?false:table==='store_members'?member:table==='get_owner_profile_safe'?{user_id:'owner',is_active:true}:table==='permission_group_items'?[{permission_key:'orders'}]:[{permission_key:'products'}];return Promise.resolve({data,error:null}).then(resolve,reject)}};return b;}
const fetcher=load('src/lib/userContextQuery.ts',{'@/integrations/supabase/client':{supabase}});
const hooks=load('src/hooks/useUserContext.tsx',{'react':React,'@tanstack/react-query':require('@tanstack/react-query'),'./useAuth':{useAuth:()=>({user,loading:false})},'@/lib/userContextQuery':fetcher});
let seen;
function Consumer(){seen=hooks.useUserContext();return null;}
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
function Harness(){return React.createElement(QueryClientProvider,{client},Array.from({length:8},(_,key)=>React.createElement(Consumer,{key})));}
const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
(async()=>{
let root;await act(async()=>{root=create(React.createElement(Harness));await tick();});
for(let attempt=0;attempt<20 && seen?.effectiveOwnerId!=='owner';attempt++)await act(tick);
assert.equal(requests.length,3,'Eight consumers must share three account requests');
assert.equal(seen.effectiveOwnerId,'owner');
await act(async()=>{user={...user};root.update(React.createElement(Harness));await tick();});
assert.equal(requests.length,3,'Token/user object refresh must not refetch account data');
member={id:'member-row',owner_id:'owner',group_id:'group'};
await act(async()=>{user={id:'member-user',app_metadata:{}};root.update(React.createElement(Harness));await tick();});
for(let attempt=0;attempt<20 && !seen?.isSubUser;attempt++)await act(tick);
assert.equal(requests.length,9);
assert.equal(seen.isSubUser,true);assert.equal(seen.hasPermission('orders'),true);assert.equal(seen.hasPermission('products'),true);assert.equal(seen.hasPermission('admin'),false);
await act(async()=>{user=null;root.update(React.createElement(Harness));await tick();});
assert.equal(seen.effectiveOwnerId,null);assert.equal(seen.hasPermission('orders'),false);
root.unmount();client.clear();

// Execute the actual Orders query aggregation and hydration effect with React.
const source=fs.readFileSync('src/pages/Orders.tsx','utf8');
const start=source.indexOf('  const ordersQuery = ');
const end=source.indexOf('  useEffect(() => {\n    const openId',start)>=0?source.indexOf('  useEffect(() => {\n    const openId',start):source.indexOf('  useEffect(() => {\r\n    const openId',start);
assert.ok(end>start);
const body=source.slice(start,end);
const setters=[...new Set(body.match(/\bset[A-Z]\w+/g))];
let renders=0;
const meta={confirmationCounts:{},statusCounts:{pending:1},deletedCount:0,productsMap:{},statusMappings:[],carrierCounts:{}};
const ordersRes={kind:'orders',data:[{id:'1'}],total:1};
const globals={React,useMemo:React.useMemo,useEffect:React.useEffect,PAGE_SIZE:50,tabPage:1,ordersMetaQuery:{isLoading:false,data:meta},ordersDataQuery:{isLoading:false,data:ordersRes},activeStoreId:'store',orderTab:'pending',effectiveOwnerId:'owner',buildIndexesFromDbMappings:()=>({statusMap:{},labelOrderMap:{},statusCategoryMap:{},labelCategoryMap:{}}),toast:()=>{},DEFAULT_STICKER_SETTINGS:{fields:[]},console};
const script=ts.transpileModule(`function Subject(){onRender();${setters.map(s=>`const [,${s}]=React.useState(null);`).join('\n')}${body}return null;} exports.Subject=Subject;`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const ex={};vm.runInNewContext(script,{...globals,exports:ex,onRender:()=>{if(++renders>12) throw Error('Orders hydration render loop');}});
await act(async()=>{root=create(React.createElement(ex.Subject));});
assert.ok(renders<=3,`Expected settled render, got ${renders}`);
root.unmount();
console.log(`PASS shared account data: 8 consumers = 3 requests (previously 24), stable token refresh, user switch, permission isolation; Orders hydration settled after ${renders} renders.`);
})().catch(e=>{console.error(e);process.exitCode=1});
