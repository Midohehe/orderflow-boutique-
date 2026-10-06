const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict'), ts=require('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const helper={exports:{}}; vm.runInNewContext(compile('supabase/functions/_shared/cod-network.ts'),helper);
const currencies={exports:{}}; vm.runInNewContext(compile('supabase/functions/_shared/currencies.ts'),currencies);
const {codItems,buildCodPayload,variantKey,codError}=helper.exports;
assert.equal(helper.exports.sameCodPhone('٠٥٠١٢٣٤٥٦٧','+966501234567','SA'),true);
assert.equal(helper.exports.sameCodPhone('0501234567','+966501234568','SA'),false);
assert.equal(helper.exports.sameCodPhone('00966501234567','+966501234567','SA'),true);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const line={id:'item',product_id:id(8),product_name:'Product',price:15,quantity:3,sku:'SKU-RED',variant_key:'[]'};
for(const [lines,total] of [[[line],55],[[{...line,quantity:305}],100.01],[[{...line,price:0,quantity:2},{...line,id:'other',quantity:4,price:0}],0.07],[[line,{...line,id:'other',quantity:2,price:30}],99.99]]) {
  const items=codItems(lines,total); assert.equal(items.reduce((sum,i)=>sum+Math.round(i.price*100)*i.quantity,0),Math.round(total*100));
  assert.equal(items.reduce((sum,i)=>sum+i.quantity,0),lines.reduce((sum,i)=>sum+i.quantity,0));
  assert.ok(items.every(i=>i.quantity>0&&i.quantity<=100&&i.price>=0));
}
for(const quantity of [0,-1,1.5,1000]) assert.throws(()=>codItems([{...line,quantity}],55),/كمية/);
assert.throws(()=>codItems([{...line,sku:''}],55),/SKU/);
assert.throws(()=>codItems([line],NaN),/مبلغ/);
assert.notEqual(variantKey({selected_color:'red',selected_size:'L'}),variantKey({selected_color:'red',selected_size:'S'}));
assert.ok(!codError({message:'invalid fixture-secret-token'},422,'fixture-secret-token').includes('fixture-secret-token'));
let state,handler;
function reset() {
  state={access:true,admin:false,auth:true,enabled:true,calls:[],mode:'success',finishError:false,shipment:null,
    order:{id:id(10),store_id:id(2),updated_at:'2026-10-06T12:00:00Z',order_code:'ORDER-10',customer_name:'عميل',phone:'0501234567',address:'شارع 1',city:'Riyadh',governorate:'حي',product_id:id(8),product_name:'Product',price:45,shipping_fee:10,quantity:3,selected_color:'red',selected_size:'L',selected_product_code:'SKU-RED',currency_code:'SAR',status:'pending',is_deleted:false,locked_insufficient_balance:false,shipping_reference:null,shipping_id:null,shipping_provider:null}};
}
const config=()=>({enabled:state.enabled,country_code:'SA',currency_code:'SAR',updated_at:'2026-10-06T11:00:00Z'});
function query(table) {
  const filters=[], q={columns:'*',single:false,select(s){q.columns=s;return q},eq(k,v){filters.push(row=>row[k]===v);return q},in(k,v){filters.push(row=>v.includes(row[k]));return q},order(){return q},limit(){return q},maybeSingle(){q.single=true;return q},upsert(){return Promise.resolve({error:null})},then(resolve,reject){
    const rows={store_cod_network_settings:[{store_id:id(2),...config()}],cod_network_credentials:[{store_id:id(2),api_token:'fixture-secret-token'}],orders:[state.order],order_items:[],cod_network_shipments:state.shipment?[{store_id:id(2),order_id:id(10),...state.shipment}]:[],store_settings:[{store_id:id(2),currency_code:'SAR'}],cod_network_sku_links:[]}[table];
    if(!rows)throw Error(table);
    const selected=rows.filter(row=>filters.every(test=>test(row))).map(row=>q.columns==='*'?row:Object.fromEntries(q.columns.split(',').map(k=>[k,row[k]])));
    return Promise.resolve({data:q.single?(selected[0]||null):selected,error:null}).then(resolve,reject);
  }};return q;
}
const caller={rpc:async name=>({data:name==='has_role'?state.admin:state.access,error:null})};
const db={auth:{getUser:async()=>({data:{user:state.auth?{id:id(1)}:null},error:null})},from:query,rpc:async(name,args)=>{
  state.calls.push({rpc:name,args});
  if(name==='save_cod_network_settings')return {data:null,error:null};
  if(name==='claim_cod_network_order') {
    if(state.shipment&&['sent','sending','uncertain'].includes(state.shipment.state)) return {data:{state:state.shipment.state==='sent'?'sent':'uncertain',reference:state.shipment.reference},error:null};
    state.shipment={state:'sending',attempt_id:id(90),request_payload:args._payload,started_at:'2026-01-01T00:00:00Z'};
    return {data:{state:'claimed',attempt_id:id(90)},error:null};
  }
  if(name==='finish_cod_network_order') {
    if(state.finishError)return {data:false,error:null};
    state.shipment={...state.shipment,state:args._state,reference:args._reference};return {data:true,error:null};
  }
  throw Error(name);
}};
vm.runInNewContext(compile('supabase/functions/cod-network/index.ts'),{
  exports:{},Request,Response,AbortSignal,Date,
  require:name=>name.includes('supabase-js')?{createClient:(_,key)=>key==='service'?db:caller}:name.includes('currencies')?currencies.exports:helper.exports,
  Deno:{env:{get:name=>name==='SUPABASE_SERVICE_ROLE_KEY'?'service':'anon'},serve:fn=>handler=fn},
  fetch:async(url,options)=>{
    state.calls.push({url,options});
    if(state.mode==='timeout')throw Error('timeout');
    if(state.mode==='reject')return Response.json({status:'error',message:'Unknown SKU; fixture-secret-token'},{status:422});
    if(state.mode==='500')return Response.json({status:'error'},{status:500});
    if(options.method==='GET'&&url.endsWith('fields=id'))return Response.json({status:'success',data:[]});
    return Response.json({status:'success',data:state.mode==='missing-id'?{}:{id:51,reference:'COD-51',customer_phone:state.mode==='wrong-phone'?'0500000000':'0501234567',total:55}},{status:options.method==='POST'?201:200});
  },
});
async function run(action,values={},authorization='Bearer fixture-session') {
  const response=await handler(new Request('https://edge.test',{method:'POST',headers:{Authorization:authorization},body:JSON.stringify({action,store_id:id(2),...values})}));
  return {status:response.status,body:await response.json()};
}
const posts=()=>state.calls.filter(call=>call.options?.method==='POST');
async function send(values={}) {
  const prepared=await run('prepare',{order_ids:[id(10)]});assert.equal(prepared.status,200);
  return run('send',{order_id:id(10),review_key:prepared.body.drafts[0].review_key,...values});
}
(async()=>{
  reset();assert.equal((await run('status',{},'')).status,401);
  state.auth=false;assert.equal((await run('status')).status,401);
  reset();state.access=false;assert.equal((await run('prepare',{order_ids:[id(10)]})).status,403);
  reset();assert.equal((await run('save')).status,403);assert.equal((await run('settings')).status,403);
  state.admin=true;const settings=await run('settings');assert.equal(settings.body.has_token,true);assert.ok(!JSON.stringify(settings).includes('fixture-secret-token'));
  assert.equal((await run('test')).body.ok,true);assert.equal(posts().length,0);
  reset();state.enabled=false;assert.equal((await run('status')).body.enabled,false);assert.equal((await run('send',{order_id:id(10)})).status,403);
  reset();assert.equal((await run('prepare',{order_ids:[id(11)]})).status,400,'foreign order IDs rejected');
  assert.equal((await run('send',{order_id:id(10),review_key:'stale'})).status,409);assert.equal(posts().length,0);
  state.order.currency_code='USD';assert.equal((await send()).status,400);assert.equal(posts().length,0);
  reset();state.order.selected_product_code='';assert.equal((await send()).status,400);assert.equal(posts().length,0);
  reset();const sent=await send({edits:{price:1,quantity:99,country:'US',currency_code:'USD'}});
  assert.equal(sent.body.reference,'COD-51');assert.equal(posts().length,1);
  const request=posts()[0];assert.equal(request.url,'https://api.cod.network/v2/seller/orders');assert.equal(request.options.headers.Authorization,'Bearer fixture-secret-token');
  const payload=JSON.parse(request.options.body);assert.equal(payload.country,'SA');assert.equal(payload.pay_mode,'cod');assert.equal(payload.items.reduce((sum,i)=>sum+Math.round(i.price*100)*i.quantity,0),5500);assert.equal(payload.items.reduce((sum,i)=>sum+i.quantity,0),3);
  assert.deepEqual(Object.keys(payload).sort(),['address','area','city','country','full_name','items','pay_mode','phone'].sort());
  assert.equal((await run('send',{order_id:id(10)})).body.already_sent,true);assert.equal(posts().length,1);
  reset();state.mode='reject';const reject=await send();assert.equal(reject.status,400);assert.equal(state.shipment.state,'failed');assert.ok(!JSON.stringify(reject).includes('fixture-secret-token'));
  state.mode='success';assert.equal((await send()).body.ok,true);assert.equal(posts().length,2);
  for(const mode of ['timeout','500','missing-id']) {
    reset();state.mode=mode;assert.equal((await send()).status,409);assert.equal(state.shipment.state,'uncertain');
    assert.equal((await run('send',{order_id:id(10)})).status,409);assert.equal(posts().length,1);
    state.mode='wrong-phone';assert.equal((await run('reconcile',{order_id:id(10),remote_id:'51'})).status,400);
    state.mode='success';assert.equal((await run('reconcile',{order_id:id(10),remote_id:'51'})).body.ok,true);assert.equal(posts().length,1,'recovery must only GET');
  }
  reset();state.finishError=true;assert.equal((await send()).status,400);assert.equal(state.shipment.state,'sending');
  assert.equal((await run('send',{order_id:id(10)})).status,409);assert.equal(posts().length,1);
  console.log('PASS COD Network: exact COD rounding and 100-unit chunks, SKU validation, API v2 contract, auth/admin/store isolation, disabled stores, secret masking, currency/revision guards, server-owned amounts, duplicate prevention, explicit retry and ambiguous-send reconciliation. No network requests performed.');
})().catch(error=>{console.error(error);process.exitCode=1});
