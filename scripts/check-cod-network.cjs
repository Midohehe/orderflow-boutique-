const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict'), ts=require('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const helper={exports:{},URL}; vm.runInNewContext(compile('supabase/functions/_shared/cod-network.ts'),helper);
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
const detailed=codError({message:'Bad Request',code:20012,errors:{'items.0.sku':['SKU unavailable']},request:{token:'fixture-secret-token'}},400,'fixture-secret-token');
assert.match(detailed,/HTTP 400/);assert.match(detailed,/20012/);assert.match(detailed,/items\.0\.sku: SKU unavailable/);assert.ok(!detailed.includes('fixture-secret-token'));
assert.match(codError({error:{message:'Invalid product'}},422),/Invalid product/);
assert.ok(!codError({message:'<b>Denied<\/b> Bearer private-token'},400).includes('private-token'));
assert.equal(helper.exports.codHasErrorCode({errors:[{code:40049}]},40049),true);
assert.equal(helper.exports.codHasErrorCode({message:'40049'},40049),false);
const nestedLead=helper.exports.codRemoteLead({status:'success',data:{id:51,phone:'0501234567',original_payload:{name:'Customer'},items:{data:[]},drop_items:{data:[{quantity:1,price:'85.00',drop_product:{data:{sku:'DROP-SKU'}}}]}}});
assert.equal(nestedLead.total,85);assert.equal(nestedLead.items[0].sku,'DROP-SKU');
assert.ok(Number.isNaN(helper.exports.codRemoteLead({status:'success',data:{id:51,phone:'0501234567',original_payload:{}}}).total));
let state,handler;
function reset() {
  state={access:true,admin:false,auth:true,enabled:true,calls:[],mode:'success',finishError:false,shipment:null,
    order:{id:id(10),store_id:id(2),updated_at:'2026-10-06T12:00:00Z',order_code:'ORDER-10',customer_name:'عميل',phone:'0501234567',address:'شارع 1',city:'Riyadh',governorate:'حي',product_id:id(8),product_name:'Product',price:45,shipping_fee:10,quantity:3,selected_color:'red',selected_size:'L',selected_product_code:'SKU-RED',currency_code:'SAR',status:'pending',is_deleted:false,locked_insufficient_balance:false,shipping_reference:null,shipping_id:null,shipping_provider:null}};
}
const config=()=>({enabled:state.enabled,country_code:'SA',currency_code:'SAR',updated_at:'2026-10-06T11:00:00Z'});
function query(table) {
  const filters=[], q={columns:'*',single:false,select(s){q.columns=s;return q},eq(k,v){filters.push(row=>row[k]===v);return q},in(k,v){filters.push(row=>v.includes(row[k]));return q},order(){return q},limit(){return q},maybeSingle(){q.single=true;return q},upsert(){return Promise.resolve({error:null})},then(resolve,reject){
    const rows={stores:[{id:id(2),slug:'shop'}],products:state.noProductPage?[]:[{id:id(8),store_id:id(2),slug:'product-page'}],store_cod_network_settings:[{store_id:id(2),...config()}],cod_network_credentials:[{store_id:id(2),api_token:'fixture-secret-token'}],orders:[state.order],order_items:state.items||[],cod_network_shipments:state.shipment?[{store_id:id(2),order_id:id(10),...state.shipment}]:[],store_settings:[{store_id:id(2),currency_code:'SAR'}],cod_network_sku_links:[]}[table];
    if(!rows)throw Error(table);
    const selected=rows.filter(row=>filters.every(test=>test(row))).map(row=>q.columns==='*'?row:Object.fromEntries(q.columns.split(',').map(k=>[k,row[k]])));
    return Promise.resolve({data:q.single?(selected[0]||null):selected,error:null}).then(resolve,reject);
  }};return q;
}
const caller={rpc:async name=>({data:name==='has_role'?state.admin:state.access,error:null})};
const db={auth:{getUser:async()=>({data:{user:state.auth?{id:id(1)}:null},error:null})},from:query,rpc:async(name,args)=>{
  state.calls.push({rpc:name,args});
  if(name==='save_cod_network_settings')return {data:null,error:null};
  if(name==='claim_cod_network_dispatch') {
    if(state.claimError)return {data:null,error:{message:'Unable to persist destination'}};
    if(state.shipment&&['sent','sending','uncertain'].includes(state.shipment.state)) return {data:{state:state.shipment.state==='sent'?'sent':'uncertain',reference:state.shipment.reference},error:null};
    state.shipment={resource_type:args._resource_type,state:'sending',attempt_id:id(90),request_payload:args._payload,started_at:'2026-01-01T00:00:00Z'};
    return {data:{state:'claimed',attempt_id:id(90)},error:null};
  }
  if(name==='set_cod_network_lead_attempt') {
    if(state.switchError)return {data:false,error:null};
    state.shipment={...state.shipment,resource_type:'lead',request_payload:args._payload};return {data:true,error:null};
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
    if(options.method==='POST') {
      assert.equal(state.shipment.resource_type,url.endsWith('/leads')?'lead':'order','destination must be durable before POST');
      assert.deepEqual(JSON.parse(JSON.stringify(state.shipment.request_payload)),JSON.parse(options.body));
    }
    if(state.mode.startsWith('drop')&&url.endsWith('/orders'))return Response.json({status:'error',message:'Bad Request',errors:[{code:40049,message:'Cannot create order with drop product.',severity:'warning'}]},{status:400});
    if(state.mode.startsWith('drop')&&url.includes('/leads')){
      if(state.mode==='drop-timeout'&&options.method==='POST')throw Error('timeout');
      if(state.mode==='drop-reject'&&options.method==='POST')return Response.json({message:'Invalid phone'},{status:400});
      if(state.mode==='drop-missing-id')return Response.json({status:'success',data:{}},{status:201});
      const payload=state.shipment.request_payload;
      const original_payload=state.mode==='drop-wrong-items'?{...payload,items:[{sku:'OTHER',price:55,quantity:1}]}:payload;
      return Response.json({status:'success',data:{id:51,phone:payload.phone,original_payload}},{status:options.method==='POST'?201:200});
    }
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
  for(const resource_type of ['order','lead']) {
    for(const address of ['', '  ', '—', null]) {
      reset();state.order.address=address;if(resource_type==='lead')state.mode='drop-success';
      assert.equal((await send({resource_type})).body.ok,true);
      assert.equal(posts().length,1);assert.equal(JSON.parse(posts()[0].options.body).address,'حي، Riyadh');
      assert.equal(state.order.address,address,'fallback must not overwrite the saved customer address');
    }
    reset();if(resource_type==='lead')state.mode='drop-success';
    assert.equal((await send({resource_type,edits:{address:'',city:'Jeddah',area:'Al Balad'}})).body.ok,true);
    assert.equal(JSON.parse(posts()[0].options.body).address,'Al Balad، Jeddah','use reviewed location when existing address is cleared');
    reset();if(resource_type==='lead')state.mode='drop-success';
    assert.equal((await send({resource_type,edits:{address:'  Street 2  '}})).body.ok,true);
    assert.equal(JSON.parse(posts()[0].options.body).address,resource_type==='lead'?'Street 2، حي، Riyadh':'Street 2');
  }
  for(const edits of [{address:123},{address:'a'.repeat(1001)},{address:'',city:''},{address:'',area:''}]) {
    reset();assert.equal((await send({edits})).status,400);assert.equal(posts().length,0);
  }
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
  reset();state.mode='drop-success';const lead=await send();assert.equal(lead.body.ok,true);assert.equal(lead.body.reference,'LEAD-51');assert.equal(lead.body.resource_type,'lead');assert.match(lead.body.warning,/بانتظار/);
  assert.equal(posts().length,2);assert.ok(posts()[1].url.endsWith('/leads'));assert.equal(state.shipment.resource_type,'lead');
  const leadPayload=JSON.parse(posts()[1].options.body);assert.equal(leadPayload.name,'عميل');assert.equal(leadPayload.address,'شارع 1، حي، Riyadh');assert.equal(leadPayload.full_name,undefined);assert.equal(leadPayload.country,'SA');assert.equal(leadPayload.items.reduce((sum,i)=>sum+Math.round(i.price*100)*i.quantity,0),5500);
  assert.equal((await run('send',{order_id:id(10)})).body.already_sent,true);assert.equal(posts().length,2);
  for(const mode of ['drop-timeout','drop-missing-id']) {
    reset();state.mode=mode;assert.equal((await send()).status,409);assert.equal(state.shipment.resource_type,'lead');assert.equal(state.shipment.state,'uncertain');
    assert.equal((await send()).status,409);assert.equal(posts().length,2);
    state.mode='drop-wrong-items';assert.equal((await run('reconcile',{order_id:id(10),remote_id:'51'})).status,400);
    state.mode='drop-success';assert.equal((await run('reconcile',{order_id:id(10),remote_id:'51'})).body.ok,true);assert.ok(state.calls.at(-2).url.endsWith('/leads/51?include=items,drop_items'));assert.equal(posts().length,2);
  }
  reset();state.mode='drop-reject';assert.equal((await send()).status,400);assert.equal(state.shipment.state,'failed');state.mode='drop-success';assert.equal((await send()).body.ok,true);assert.equal(posts().length,3,'corrected lead retries directly without another order POST');
  reset();state.mode='drop-success';state.switchError=true;assert.equal((await send()).status,409);assert.equal(posts().length,1,'do not POST lead unless destination is persisted');
  // An explicit Lead must never first create an Order; an explicit Order never
  // silently becomes a Lead, even for the legacy drop-product rejection code.
  reset();state.mode='drop-success';
  const directLead=await send({resource_type:'lead'});
  assert.equal(directLead.body.resource_type,'lead');assert.equal(directLead.body.reference,'LEAD-51');
  assert.equal(posts().length,1);assert.equal(posts()[0].url,'https://api.cod.network/v2/seller/leads');
  const directPayload=JSON.parse(posts()[0].options.body);
  for(const key of ['name','phone','country','address','items','original_phone'])assert.ok(Object.hasOwn(directPayload,key));
  assert.equal(directPayload.original_phone,state.order.phone);
  for(const [index,item] of directPayload.items.entries()) {
    const n=index+1;
    assert.equal(directPayload[`country_${n}`],'KSA');assert.equal(directPayload[`name_${n}`],'عميل');
    assert.equal(directPayload[`adress_${n}`],directPayload.address);assert.equal(directPayload[`url_${n}`],'https://www.was-la.com/p/shop/product-page');
    assert.equal(directPayload[`sku_${n}`],item.sku);assert.equal(directPayload[`product_${n}`],'Product');
    assert.equal(directPayload[`quantity_${n}`],item.quantity);assert.equal(directPayload[`price_${n}`],item.price);assert.equal(directPayload[`currency_${n}`],'SAR');
  }
  assert.equal(directPayload.name,'عميل');assert.equal(directPayload.phone,'0501234567');
  assert.equal(directPayload.items.reduce((sum,i)=>sum+Math.round(i.price*100)*i.quantity,0),5500);
  assert.equal((await send({resource_type:'order'})).body.already_sent,true);assert.equal(posts().length,1);
  reset();state.mode='drop-success';state.order.landing_slug='campaign-page';
  assert.equal((await send({resource_type:'lead',edits:{phone:'0507654321',currency_code:'USD',original_phone:'spoof',product_1:'spoof'}})).body.ok,true);
  const metadata=JSON.parse(posts()[0].options.body);
  assert.equal(metadata.url_1,'https://www.was-la.com/p/shop/campaign-page');assert.equal(metadata.phone,'0507654321');
  assert.equal(metadata.original_phone,'0501234567');assert.equal(metadata.currency_1,'SAR');assert.equal(metadata.product_1,'Product');
  for(const source_url of ['', 'javascript:alert(1)', 'https://user:pass@example.com/p/x', 'http://example.com/p/x']) {
    reset();assert.equal((await send({resource_type:'lead',edits:{source_url}})).status,400);assert.equal(posts().length,0);assert.equal(state.shipment,null);
  }
  reset();state.noProductPage=true;assert.equal((await send({resource_type:'lead'})).status,400);assert.equal(posts().length,0);
  state.mode='drop-success';assert.equal((await send({resource_type:'lead',edits:{source_url:'https://example.com/product'}})).body.ok,true);
  assert.equal(JSON.parse(posts()[0].options.body).url_1,'https://example.com/product');
  reset();state.noProductPage=true;assert.equal((await send({resource_type:'order'})).body.ok,true,'Orders does not require a landing URL');
  reset();state.noProductPage=true;state.mode='drop-success';
  assert.equal((await send()).status,400);assert.equal(posts().length,1);assert.equal(state.shipment.state,'failed','definitive drop rejection plus incomplete metadata is safely retryable');
  reset();state.mode='drop-success';state.items=[
    {...line,id:'first',order_id:id(10),store_id:id(2),product_name:'First',selected_product_code:'SKU-RED',quantity:305},
    {...line,id:'second',order_id:id(10),store_id:id(2),product_name:'Second',selected_product_code:'SKU-RED',quantity:2},
  ];
  assert.equal((await send({resource_type:'lead'})).body.ok,true);
  const many=JSON.parse(posts()[0].options.body);let firstQuantity=0,secondQuantity=0,flatCents=0;
  for(const [index,item] of many.items.entries()) {
    const n=index+1;assert.equal(many[`quantity_${n}`],item.quantity);assert.equal(many[`price_${n}`],item.price);
    if(many[`product_${n}`]==='First')firstQuantity+=item.quantity;else {assert.equal(many[`product_${n}`],'Second');secondQuantity+=item.quantity;}
    flatCents+=Math.round(many[`price_${n}`]*100)*many[`quantity_${n}`];
  }
  assert.equal(firstQuantity,305);assert.equal(secondQuantity,2);assert.equal(flatCents,5500);
  reset();state.mode='drop-success';const explicitOrder=await send({resource_type:'order'});
  assert.equal(explicitOrder.status,400);assert.match(explicitOrder.body.error,/Lead/);
  assert.equal(posts().length,1);assert.equal(state.shipment.state,'failed');assert.equal(state.shipment.resource_type,'order');
  assert.equal((await send({resource_type:'lead'})).body.ok,true);assert.equal(posts().length,2);
  reset();state.mode='reject';assert.equal((await send({resource_type:'lead'})).status,400);
  state.mode='success';assert.equal((await send({resource_type:'order'})).body.ok,true);
  assert.equal(state.shipment.resource_type,'order');assert.ok(posts()[1].url.endsWith('/orders'));
  reset();state.mode='drop-timeout';assert.equal((await send({resource_type:'lead'})).status,409);
  assert.equal((await send({resource_type:'order'})).status,409);assert.equal(posts().length,1);
  assert.equal(state.shipment.resource_type,'lead');state.mode='drop-success';
  assert.equal((await run('reconcile',{order_id:id(10),remote_id:'51',resource_type:'order'})).body.resource_type,'lead');
  assert.ok(state.calls.some(c=>c.url?.endsWith('/leads/51?include=items,drop_items')));
  assert.equal(posts().length,1,'uncertain lead only reconciles through GET, regardless of current selection');
  for(const invalid of [null,'leads','orders','',{},true]) {
    reset();assert.equal((await send({resource_type:invalid})).status,400);assert.equal(posts().length,0);assert.equal(state.shipment,null);
  }
  reset();state.claimError=true;assert.equal((await send({resource_type:'lead'})).status,400);assert.equal(posts().length,0);
  console.log('PASS COD Network: exact COD rounding and 100-unit chunks, SKU validation, API v2 contract, auth/admin/store isolation, disabled stores, secret masking, currency/revision guards, server-owned amounts, duplicate prevention, explicit retry and ambiguous-send reconciliation. No network requests performed.');
})().catch(error=>{console.error(error);process.exitCode=1});
