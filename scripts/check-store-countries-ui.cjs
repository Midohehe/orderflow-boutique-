const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),Module=require('node:module');
const deps=process.env.REACT_TEST_DEPS||path.resolve('../test-deps/node_modules'),React=require(path.join(deps,'react'));
const original=Module._load;Module._load=function(name,...args){return name==='react'?React:original.call(this,name,...args)};
const {act,create}=require(path.join(deps,'react-test-renderer'));
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const catalog={exports:{}};vm.runInNewContext(compile('src/lib/countries.ts'),catalog);
assert.equal(catalog.exports.COUNTRY_CODES.length,249);assert.equal(new Set(catalog.exports.COUNTRY_CODES).size,249);
const host=tag=>props=>React.createElement(tag,props,props.children),wrap=host('div');
let calls=[],invalidations=[],rpc=async()=>({data:2,error:null}),active='a',owner='owner',user='owner';
const modules={react:React,'react/jsx-runtime':require('react/jsx-runtime'),
 '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries:async value=>invalidations.push(value.queryKey)}),useQuery:()=>({data:active==='a'?['LY']:['SA'],isPending:false,isError:false})},
 '@/integrations/supabase/client':{supabase:{rpc:async(name,args)=>{calls.push({name,args});return rpc(name,args)}}},
 '@/hooks/useStoreContext':{useStoreContext:()=>({activeStoreId:active,activeStore:{owner_id:owner,name:'متجر'}})},
 '@/hooks/useUserContext':{useUserContext:()=>({isAdmin:false,loading:false})},'@/hooks/useAuth':{useAuth:()=>({user:{id:user}})},
 '@/lib/countries':catalog.exports,'lucide-react':new Proxy({},{get:()=>()=>null})};
function load(file){const context={exports:{},Error,require:name=>{
 if(modules[name])return modules[name];if(name.startsWith('@/components/'))return new Proxy({},{get:(_,key)=>({Button:host('button'),Input:host('input'),Checkbox:host('checkbox'),Select:host('select-control'),SelectItem:host('option')}[key]||wrap)});throw Error(name);
 }};vm.runInNewContext(compile(file),context);return context.exports}
const Countries=load('src/pages/CountrySettings.tsx').default;
const Move=load('src/components/AcceptCountryOrdersButton.tsx').AcceptCountryOrdersButton;
const Filter=load('src/components/OrderCountryFilter.tsx').OrderCountryFilter;
const words=x=>Array.isArray(x)?x.map(words).join(''):typeof x==='string'||typeof x==='number'?String(x):x?.props?words(x.props.children):'';
const button=(tree,label)=>tree.root.findAllByType('button').find(n=>words(n.props.children).includes(label));
const checkbox=(tree,code)=>tree.root.findAllByType('checkbox').find(n=>n.props['aria-label']===catalog.exports.countryName(code));
const text=tree=>JSON.stringify(tree.toJSON());
(async()=>{
 let tree;
 await act(async()=>{tree=create(React.createElement(Countries))});assert.equal(checkbox(tree,'LY').props.checked,true);assert.equal(checkbox(tree,'SA').props.checked,false);
 await act(async()=>tree.root.findByType('input').props.onChange({target:{value:'SA'}}));assert.equal(tree.root.findAllByType('checkbox').length,1);
 await act(async()=>checkbox(tree,'SA').props.onCheckedChange(true));
 await act(async()=>button(tree,'حفظ دول المتجر').props.onClick());assert.equal(calls[0].name,'save_store_order_countries');assert.equal(calls[0].args._store_id,'a');assert.deepEqual(Array.from(calls[0].args._countries),['LY','SA']);assert.ok(text(tree).includes('ونقل 2 طلب'));assert.ok(invalidations.some(k=>k[0]==='orders-page-meta'&&k[1]==='a'));
 await act(async()=>{active='b';tree.update(React.createElement(Countries))});assert.equal(checkbox(tree,'LY').props.checked,false);assert.equal(checkbox(tree,'SA').props.checked,true,'switching store remounts independent settings');
 await act(async()=>checkbox(tree,'SA').props.onCheckedChange(false));assert.equal(button(tree,'حفظ دول المتجر').props.disabled,true);
 await act(async()=>checkbox(tree,'LY').props.onCheckedChange(true));rpc=async()=>({data:null,error:{message:'Access denied'}});
 await act(async()=>button(tree,'حفظ دول المتجر').props.onClick());assert.ok(text(tree).includes('Access denied'));assert.ok(!text(tree).includes('تم حفظ'));
 await act(async()=>{user='staff';tree.update(React.createElement(Countries))});assert.equal(tree.root.findAllByType('checkbox').length,0);assert.ok(text(tree).includes('للمالك والسوبر'));
 await act(async()=>tree.unmount());
 let changed;await act(async()=>{tree=create(React.createElement(Filter,{value:'all',counts:{LY:6,SA:2,unknown:1},onChange:value=>changed=value}))});
 assert.equal(tree.root.findAllByType('option').length,4);assert.ok(text(tree).includes('غير محددة'));
 await act(async()=>tree.root.findByType('select-control').props.onValueChange('SA'));assert.equal(changed,'SA');
 await act(async()=>tree.update(React.createElement(Filter,{value:'SA',counts:{LY:6},onChange(){}})));assert.equal(tree.root.findAllByType('option').some(n=>n.props.value==='SA'),true,'selected zero-count country remains labelled');
 await act(async()=>tree.unmount());
 let completed=0,resolve;calls=[];rpc=()=>new Promise(done=>resolve=done);
 await act(async()=>{tree=create(React.createElement(Move,{storeId:'a',orderIds:[],onDone:n=>completed+=n}))});assert.equal(button(tree,'نقل المحدد').props.disabled,true);
 await act(async()=>tree.update(React.createElement(Move,{storeId:'a',orderIds:['one','two'],onDone:n=>completed+=n})));
 const send=button(tree,'نقل المحدد').props.onClick;await act(async()=>{send();send()});assert.equal(calls.length,1);assert.equal(button(tree,'نقل المحدد').props.disabled,true);
 await act(async()=>resolve({data:2,error:null}));assert.equal(completed,2);assert.equal(calls[0].args._store_id,'a');assert.deepEqual(Array.from(calls[0].args._order_ids),['one','two']);
 rpc=async()=>({data:null,error:{message:'تغيرت حالة الطلب'}});await act(async()=>button(tree,'نقل المحدد').props.onClick());assert.equal(completed,2);assert.ok(text(tree).includes('تغيرت حالة'));
 rpc=()=>new Promise(done=>resolve=done);await act(async()=>button(tree,'نقل المحدد').props.onClick());await act(async()=>tree.unmount());await act(async()=>resolve({data:2,error:null}));assert.equal(completed,2,'late response cannot mutate another store after unmount');
 console.log('PASS country UI: 249 countries, search/multiple selection, empty validation, store isolation and owner gate, success/error and cache refresh, labelled country counts, transfer selection/double-click guard and late response isolation.');
})().catch(error=>{console.error(error);process.exitCode=1});
