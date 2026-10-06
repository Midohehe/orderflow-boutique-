const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),Module=require('node:module');
const deps=process.env.REACT_TEST_DEPS||path.resolve('../test-deps/node_modules'), React=require(path.join(deps,'react'));
const original=Module._load;Module._load=function(name,...args){return name==='react'?React:original.call(this,name,...args)};
const {act,create}=require(path.join(deps,'react-test-renderer'));
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const helper={exports:{},Error};vm.runInNewContext(compile('supabase/functions/_shared/cod-network.ts'),helper);
const money={exports:{}};vm.runInNewContext(compile('supabase/functions/_shared/currencies.ts'),money);
const host=tag=>props=>React.createElement(tag,props,props.children);
const wrap=host('div');let api=async()=>{},calls=[],config={enabled:true,country_code:'SA',currency_code:'SAR',has_token:true};
const disabledConfig={enabled:false,country_code:'SA',currency_code:'SAR'};
const queries=({queryKey})=>({data:queryKey[0]==='cod-network-admin-stores'?[{id:'a',name:'متجر ألف',slug:'alef'},{id:'b',name:'متجر باء',slug:'baa'}]:queryKey[1]==='a'?config:disabledConfig,isPending:false,isError:false,isFetching:false});
const modules={react:React,'react/jsx-runtime':require('react/jsx-runtime'),'@tanstack/react-query':{useQuery:queries,useQueryClient:()=>({invalidateQueries:async()=>{}})},
  '@/integrations/supabase/client':{supabase:{}},'@/lib/currencies':money.exports,
  '@/lib/codNetwork':{...helper.exports,codNetwork:async(action,store,values)=>{calls.push({action,store,values});return api(action,store,values)}},
  'lucide-react':new Proxy({}, {get:()=>()=>null})};
function load(file) {
  const context={exports:{},Error,require:name=>{
    if(modules[name])return modules[name];
    if(name.startsWith('@/components/'))return new Proxy({},{get:(_,key)=>({Button:host('button'),Input:host('input'),Label:host('label'),Switch:host('switch'),SearchableSelect:host('store-select'),Dialog:props=>props.open?React.createElement('dialog',props,props.children):null}[key]||wrap)});
    throw Error(name);
  }};vm.runInNewContext(compile(file),context);return context.exports;
}
const {CodNetworkShippingButton:Shipping}=load('src/components/CodNetworkShippingButton.tsx'), Admin=load('src/components/CodNetworkAdminSettings.tsx').default;
const draft=n=>({id:`order-${n}`,review_key:`review-${n}`,order_code:`${n}`,updated_at:'now',currency_code:'SAR',full_name:'عميل',phone:'0501234567',address:'شارع',city:'Riyadh',area:'حي',country:'SA',total:55,shipment:null,items:[{id:`item-${n}`,product_id:`product-${n}`,product_name:'منتج',quantity:3,price:15,sku:'SKU-RED',variant_key:'[]'}]});
const text=tree=>JSON.stringify(tree.toJSON());
const words=value=>Array.isArray(value)?value.map(words).join(''):typeof value==='string'||typeof value==='number'?String(value):value?.props?words(value.props.children):'';
const button=(tree,label)=>tree.root.findAllByType('button').find(node=>words(node.props.children).includes(label));
const click=async(tree,label)=>{const node=button(tree,label);assert.ok(node,label);assert.equal(!!node.props.disabled,false,label+' should be enabled');await act(async()=>node.props.onClick())};
(async()=>{
  let tree,done=0;
  await act(async()=>{tree=create(React.createElement(Shipping,{storeId:'b',orderIds:['order-1'],onDone(){done++}}))});assert.equal(tree.toJSON(),null,'disabled store has no button');
  await act(async()=>tree.update(React.createElement(Shipping,{storeId:'a',orderIds:[],onDone(){done++}})));assert.equal(button(tree,'إرسال لشركة').props.disabled,true);
  let prepared=0,resolveSend;
  api=async(action,store,values)=>{
    assert.equal(store,'a');
    if(action==='prepare')return {drafts:++prepared===1?[draft(1),draft(2)]:[{...draft(1),shipment:{state:'sent',reference:'COD-51'}},{...draft(2),shipment:{state:'failed',reference:null}}]};
    if(action==='send') {
      assert.equal(values.review_key,values.order_id==='order-1'?'review-1':'review-2');
      if(values.order_id==='order-1')return new Promise(resolve=>resolveSend=resolve);
      throw Error('SKU غير موجود');
    }
    throw Error(action);
  };
  await act(async()=>tree.update(React.createElement(Shipping,{storeId:'a',orderIds:['order-1','order-2'],onDone(){done++}})));
  await click(tree,'إرسال لشركة');assert.ok(text(tree).includes('تأكيد إرسال 2 طلب'));
  assert.equal(tree.root.findAllByType('input').filter(node=>node.props.type==='number').length,0,'prices and quantities are readonly');
  await click(tree,'تأكيد إرسال');assert.equal(button(tree,'جاري الإرسال').props.disabled,true);
  await act(async()=>resolveSend({ok:true,reference:'COD-51'}));
  assert.ok(text(tree).includes('COD-51'));assert.ok(text(tree).includes('SKU غير موجود'));assert.ok(text(tree).includes('تمت معالجة 2 من 2'));assert.equal(done,1);
  assert.ok(text(tree).includes('تأكيد إرسال 1 طلب'),'successful rows cannot be sent again');
  assert.equal(calls.filter(c=>c.action==='send').length,2);
  await act(async()=>tree.unmount());
  api=async()=>({drafts:[{...draft(1),items:[{...draft(1).items[0],sku:''}]}]});
  await act(async()=>{tree=create(React.createElement(Shipping,{storeId:'a',orderIds:['order-1'],onDone(){}}))});
  await click(tree,'إرسال لشركة');assert.ok(text(tree).includes('رمز SKU'));assert.equal(button(tree,'تأكيد إرسال').props.disabled,true);
  const sku=tree.root.findAllByType('input').find(node=>node.props.placeholder==='SKU لدى سعودي نيتورك');
  await act(async()=>sku.props.onChange({target:{value:'REVIEWED-SKU'}}));assert.equal(button(tree,'تأكيد إرسال').props.disabled,false);
  await act(async()=>tree.unmount());
  let resolvePrepare;api=()=>new Promise(resolve=>resolvePrepare=resolve);
  await act(async()=>{tree=create(React.createElement(Shipping,{storeId:'a',orderIds:['order-1'],onDone(){}}))});
  await click(tree,'إرسال لشركة');await act(async()=>tree.update(React.createElement(Shipping,{storeId:'b',orderIds:[],onDone(){}})));
  await act(async()=>resolvePrepare({drafts:[draft(1)]}));assert.equal(tree.toJSON(),null,'a late preview cannot leak into another store');
  await act(async()=>tree.unmount());
  calls=[];api=async()=>({ok:true});
  await act(async()=>{tree=create(React.createElement(Admin))});
  await act(async()=>tree.root.findByType('store-select').props.onChange('a'));
  assert.equal(tree.root.findByProps({id:'cod-token'}).props.type,'password');
  await act(async()=>tree.root.findByProps({id:'cod-token'}).props.onChange({target:{value:'fixture-new-token'}}));
  await click(tree,'حفظ إعدادات المتجر');
  assert.equal(calls[0].action,'save');assert.equal(calls[0].store,'a');assert.equal(calls[0].values.api_token,'fixture-new-token');
  assert.equal(tree.root.findByProps({id:'cod-token'}).props.value,'');assert.ok(text(tree).includes('تم حفظ إعدادات الربط'));
  await act(async()=>tree.root.findByType('store-select').props.onChange('b'));
  assert.equal(tree.root.findByProps({id:'cod-enabled'}).props.checked,false);
  assert.equal(tree.root.findByProps({id:'cod-token'}).props.value,'');
  await act(async()=>tree.unmount());
  console.log('PASS COD Network UI: per-store visibility, selection, reviewed SKU/currency validation, immutable amounts, sequential progress and partial errors, no resending successes, store-switch isolation and admin secret saving/clearing.');
})().catch(error=>{console.error(error);process.exitCode=1});
