const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const helper={exports:{},crypto:webcrypto,TextEncoder};vm.runInNewContext(compile('supabase/functions/_shared/turbo-products.ts'),helper);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let state,handler;
const product=()=>({id:id(10),store_id:id(1),owner_id:id(2),name:'Shirt',price:99,colors:['Red','Blue'],sizes:['L','M'],product_codes:[],variant_skus:{'Red - L':'RED-L'},variant_warehouse_codes:{},warehouse_linked:true,deleted_at:null});
function reset(){state={product:product(),access:true,auth:true,enabled:true,record:null,posts:[],lookups:0,remote:null,mode:'success'}}
function query(table){const filters=[],q={select(){return q},eq(k,v){filters.push(row=>row[k]===v);return q},order(){return q},limit(){return q},maybeSingle(){q.single=true;return q},then(resolve,reject){const tables={products:[state.product],shipping_settings:[{store_id:id(1),email:'fixture-user',password:'fixture-password',endpoint:'https://turbo.test/graphql',enabled:state.enabled}],turbo_product_exports:state.record?[{...state.record,product_id:id(10),store_id:id(1),variant_key:'Red - L'}]:[],app_settings:[{shipping_endpoint:null}]};const rows=tables[table].filter(row=>filters.every(f=>f(row)));return Promise.resolve({data:q.single?(rows[0]||null):rows,error:null}).then(resolve,reject)}};return q}
const db={auth:{getUser:async()=>({data:{user:state.auth?{id:id(2)}:null}})},from:query,rpc:async(name,args)=>{
 if(name==='claim_turbo_product_export'){
  if(state.record){if(state.record.state==='created')return{data:{...state.record,outcome:'created'}};if(state.record.state==='sending')return{data:{...state.record,outcome:'busy'}};if(state.record.state==='uncertain')return{data:{...state.record,outcome:'reconcile'}};}
  state.record={state:'sending',attempt_id:id(90),payload:args._payload};return{data:{...state.record,outcome:'claimed'}};
 }
 if(name==='finish_turbo_product_export'){if(state.finishError)return{error:{message:'unavailable'}};state.record={...state.record,state:args._state};if(args._state==='created')state.product.variant_warehouse_codes['Red - L']=args._remote.code;return{data:true}}throw Error(name)
}};
vm.runInNewContext(compile('supabase/functions/create-turbo-products/index.ts'),{exports:{},Request,Response,AbortSignal,URL,TextEncoder,crypto:webcrypto,
 require:name=>name.includes('supabase-js')?{createClient:(_,key)=>key==='service'?db:{rpc:async()=>({data:state.access})}}:helper.exports,
 Deno:{env:{get:name=>name==='SUPABASE_SERVICE_ROLE_KEY'?'service':'anon'},serve:fn=>handler=fn},
 fetch:async(_,options)=>{const body=JSON.parse(options.body);
  if(body.query.includes('login('))return Response.json({data:{login:{token:'fixture-token'}}});
  if(body.query.includes('listProducts(')){state.lookups++;return Response.json({data:{listProducts:{paginatorInfo:{lastPage:1},data:state.remote?[state.remote]:[]}}})}
  assert.ok(body.query.includes('saveProduct'));state.posts.push(body.variables.input);assert.equal(state.record.state,'sending');
  const remote={id:71,...body.variables.input,availableQuantity:0};state.remote=remote;
  if(state.mode==='timeout')throw Error('timeout');
  if(state.mode==='validation'){state.remote=null;return Response.json({errors:[{extensions:{category:'validation'}}]})}
  return Response.json({data:{saveProduct:remote}})
 }});
async function run(action='sync',extra={}){const r=await handler(new Request('https://edge.test',{method:'POST',headers:{Authorization:'Bearer fixture-session'},body:JSON.stringify({action,store_id:id(1),product_id:id(10),variant_key:'Red - L',weight:0.5,...extra})}));return{status:r.status,body:await r.json()}}
(async()=>{
 reset();let plan=await helper.exports.turboProductPlan(state.product);assert.equal(plan.length,4);assert.equal(plan[0].code,'RED-L');assert.equal(new Set(plan.map(v=>v.code)).size,4);
 const codes=Object.fromEntries(plan.map(v=>[v.key,v.code]));state.product.colors.reverse();plan=await helper.exports.turboProductPlan(state.product);for(const row of plan)assert.equal(row.code,codes[row.key]);
 state.product.variant_skus={'Red - L':'DUP','Red - M':'DUP'};await assert.rejects(helper.exports.turboProductPlan(state.product),/كود مختلف/);
 reset();state.product.colors=[];state.product.sizes=[];plan=await helper.exports.turboProductPlan(state.product);assert.equal(plan[0].key,'');assert.equal(plan[0].name,'Shirt');
 reset();state.auth=false;assert.equal((await run()).status,401);assert.equal(state.posts.length,0);
 reset();state.access=false;assert.equal((await run()).status,403);assert.equal(state.posts.length,0);
 reset();assert.equal((await run('prepare',{store_id:id(3)})).status,404);
 reset();state.enabled=false;assert.equal((await run()).status,400);assert.equal(state.posts.length,0);
 reset();assert.equal((await run('sync',{weight:0})).status,400);assert.equal(state.posts.length,0);
 reset();assert.equal((await run()).body.ok,true);assert.equal(state.posts.length,1);assert.equal(state.posts[0].name,'Shirt — Red - L');assert.equal(state.posts[0].price,99);assert.equal(state.posts[0].weight,0.5);assert.ok(!Object.hasOwn(state.posts[0],'availableQuantity'));
 assert.equal((await run()).body.ok,true);assert.equal(state.posts.length,1);
 reset();state.remote={id:71,code:'RED-L',name:'Other',price:99,weight:0.5};assert.equal((await run()).status,400);assert.equal(state.posts.length,0);
 reset();state.mode='timeout';assert.equal((await run()).status,409);assert.equal(state.record.state,'uncertain');assert.equal(state.posts.length,1);
 assert.equal((await run()).body.ok,true);assert.equal(state.record.state,'created');assert.equal(state.posts.length,1,'recovery only performs lookup');
 reset();state.mode='timeout';await run();state.remote=null;assert.equal((await run()).status,409);assert.equal(state.posts.length,1);
 reset();state.record={state:'sending'};assert.equal((await run()).status,409);assert.equal(state.posts.length,0);
 reset();state.mode='validation';assert.equal((await run()).status,400);assert.equal(state.record.state,'failed');state.mode='success';assert.equal((await run()).body.ok,true);
 reset();state.finishError=true;assert.equal((await run()).status,400);assert.equal(state.posts.length,1);assert.equal((await run()).status,409);assert.equal(state.posts.length,1);
 console.log('PASS Turbo: variant combinations/stable unique codes, exact ProductInput, read-only preflight, auth/store isolation, saved mapping, no stock mutation, timeout recovery and duplicate prevention. No real API mutations.');
})().catch(e=>{console.error(e);process.exitCode=1});
