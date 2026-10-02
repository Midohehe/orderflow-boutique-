const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const source=fs.readFileSync('supabase/functions/sync-carrier-statuses/index.ts','utf8').replace(/^import .*\r?\n/gm,'');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const storeId='00000000-0000-0000-0000-000000000001',jobId='00000000-0000-0000-0000-000000000002';
async function run(options={}) {
 let handler,finish,release,remote=0,claims=0;const updates=[];
 const ids=['1','2','3','4','5'];
 const job={id:jobId,total:5,processed:0,updated:0,failed:0,state:'running',codes:[],errors:[]};
 const admin={auth:{getUser:async()=>({data:{user:options.unauthorized?null:{id:'owner'}},error:null})},rpc:async(name,input)=>{
   if(name==='list_carrier_mappings_for_store')return {data:[{status_code:'DTR',custom_label:'DELIVERED'}]};
   if(name==='start_carrier_sync')return {data:job};
   if(name==='claim_carrier_sync_batch'){claims++;return {data:{busy:!!options.busy,job,lease_id:'lease',order_ids:ids}}}
   if(name==='finish_carrier_sync_batch'){finish=input;return {data:{...job,processed:5,state:'completed',updated:input._updated,failed:input._failed}}}
   throw Error(name);
 },from:table=>{let payload,filters={};const b={select:()=>b,eq:(k,v)=>{filters[k]=v;return b},in:()=>b,order:()=>b,limit:()=>b,maybeSingle:()=>b,single:()=>b,update:p=>{payload=p;return b},then:(resolve,reject)=>{
   let data=null,error=null;
   if(table==='stores')data={id:storeId,owner_id:options.foreign?'other':'owner'};
   if(table==='shipping_settings')data=[{email:'mock-user',password:'mock-password',endpoint:'https://carrier.test/graphql'}];
   if(table==='app_settings')data={shipping_endpoint:'https://carrier.test/graphql'};
   if(table==='orders'&&!payload)data=ids.map(id=>({id,shipping_id:id==='5'?'invalid':Number(id),shipping_reference:'REF-'+id,status:'shipped',is_deleted:false}));
   if(table==='orders'&&payload){updates.push({id:filters.id,payload});data={id:filters.id};if(filters.id==='3')error={message:'write denied'};}
   if(table==='carrier_sync_jobs'&&payload)release=payload;
   return Promise.resolve({data,error}).then(resolve,reject);
 }};return b}};
 const fetch=async(url,init)=>{
   assert.ok(init.signal,'All external requests require deadlines');remote++;
   const body=JSON.parse(init.body);
   if(body.query.includes('mutation Login')) return new Response(JSON.stringify(options.loginFail?{errors:[{}]}:{data:{login:{token:'mock-token'}}}),{status:200});
   const id=String(body.variables.id);
   if(id==='2')return new Response(JSON.stringify({data:{shipment:null}}));
   if(id==='4'&&options.timeout){const e=new Error('Timed out');e.name='TimeoutError';throw e;}
   return new Response(JSON.stringify({data:{shipment:{status:{code:'DTR',name:'Delivered'}}}}));
 };
 vm.runInNewContext(js,{exports:{},createClient:()=>admin,carrierCodeToOrderStatus:()=>null,Deno:{env:{get:()=> 'mock'},serve:f=>{handler=f}},fetch,Response,AbortSignal,Map,Date,Number,Error,console});
 const request=new Request('https://edge.test/',{method:'POST',headers:options.noAuth?{}:{Authorization:'Bearer mock'},body:JSON.stringify({store_id:storeId,action:options.action||'batch',job_id:jobId})});
 const response=await handler(request);return {status:response.status,body:await response.json(),finish,release,remote,claims,updates};
}
(async()=>{
 let r=await run({noAuth:true});assert.equal(r.status,401);assert.equal(r.remote,0);
 r=await run({foreign:true});assert.equal(r.status,403);assert.equal(r.claims,0);
 r=await run({busy:true});assert.equal(r.status,200);assert.equal(r.remote,0);assert.equal(r.body.busy,true);
 r=await run();assert.equal(r.status,200);assert.equal(r.finish._updated,2);assert.equal(r.finish._failed,3);assert.equal(r.finish._errors.length,3);assert.equal(r.finish._codes[0].count,2);assert.equal(r.updates[0].payload.carrier_status,'DELIVERED');assert.equal(r.updates.some(x=>'status' in x.payload),false);
 r=await run({timeout:true});assert.equal(r.finish._failed,4);assert.ok(r.finish._errors.some(x=>x.includes('مهلة')));
 r=await run({loginFail:true});assert.equal(r.status,502);assert.equal(r.release.lease_id,null);assert.equal(r.finish,undefined);
 r=await run({action:'start'});assert.equal(r.body.job.total,5);assert.equal(r.remote,0);
 console.log('PASS Edge sync: auth, store isolation, busy lease, bounded requests, successful writes, invalid IDs, carrier failures, write failures, timeout, login recovery, no automatic delivered settlement.');
})().catch(e=>{console.error(e);process.exitCode=1});
