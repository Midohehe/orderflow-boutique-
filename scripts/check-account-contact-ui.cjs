const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict'),Module=require('module');
const deps=process.env.REACT_TEST_DEPS||path.resolve('../test-deps/node_modules');
const React=require(path.join(deps,'react'));const original=Module._load;Module._load=function(n,...a){return n==='react'?React:original.call(this,n,...a)};
const {act,create}=require(path.join(deps,'react-test-renderer'));
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const phoneModule={exports:{}};vm.runInNewContext(compile('supabase/functions/_shared/contact-phone.ts'),phoneModule);
const registrationModule={exports:{},require:n=>n==='zod'?require('zod'):phoneModule.exports};vm.runInNewContext(compile('src/lib/storeRegistration.ts'),registrationModule);
const helperModule={exports:{},require:()=>({})};vm.runInNewContext(compile('src/lib/adminUsers.ts'),helperModule);
const tick=()=>new Promise(r=>setTimeout(r,0));
const wrap=p=>React.createElement('div',p,p.children);
const host=type=>p=>React.createElement(type,p,p.children);
let sent,queryOptions;
const fixtures=[
  {user_id:'1',username:'owner1',full_name:'تاجر تجريبي',email:'test@example.test',phone:'0912345678',email_confirmed_at:'2026-10-01T10:00:00Z',kind:'owner',status:'active',has_profile:true,profile_active:true,created_at:'2026-10-01',last_sign_in_at:null,stores:[]},
  {user_id:'2',username:'owner2',full_name:'حساب معطّل',email:'other@example.test',phone:null,email_confirmed_at:null,kind:'owner',status:'disabled',has_profile:true,profile_active:false,created_at:'2026-10-01',last_sign_in_at:null,stores:[]},
  {user_id:'3',username:'courier',full_name:'مندوب تجريبي',email:null,phone:null,email_confirmed_at:'2026-10-01T10:00:00Z',kind:'courier',status:'active',has_profile:false,created_at:'2026-10-01',last_sign_in_at:null,stores:[]},
];
const imports={
  react:React,'react/jsx-runtime':require('react/jsx-runtime'),'react-router-dom':{Link:host('a')},
  '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries:async()=>{}}),useQuery:opts=>{queryOptions=opts;return {data:{users:fixtures,total:3,page:1,page_size:25,summary:{total:3,active:2,owners:2,staff:0,couriers:1,unlinked:3}},isFetching:false}}},
  'lucide-react':new Proxy({},{get:()=>()=>null}),
  '@/hooks/use-toast':{toast:()=>{}},
  '@/lib/contactPhone':phoneModule.exports,
  '@/lib/storeRegistration':registrationModule.exports,
  '@/lib/adminUsers':{...helperModule.exports,manageAdminUser:async(action,payload)=>{sent={action,payload}}},
};
const uiNames={Button:host('button'),Input:host('input'),PasswordInput:host('input'),Label:host('label'),Dialog:p=>p.open?React.createElement(React.Fragment,null,p.children):null};
const load=name=>imports[name]|| (name.includes('/components/')?new Proxy({},{get:(_,key)=>uiNames[key]||wrap}):(()=>{throw Error(name)})());
const context={exports:{},require:load,setTimeout,clearTimeout,console};vm.runInNewContext(compile('src/components/AdminUserDirectory.tsx'),context);
(async()=>{let tree;await act(async()=>{tree=create(React.createElement(context.exports.default));await tick()});
  let text=JSON.stringify(tree.toJSON());assert.ok(text.includes('البريد مؤكّد'));assert.ok(text.includes('البريد غير مؤكّد'));assert.ok(text.includes('بدون بريد إلكتروني'));assert.ok(text.includes('معطّل'));assert.ok(text.includes('0912345678'));
  const filter=tree.root.findAll(n=>n.props['aria-label']==='تأكيد البريد الإلكتروني')[0];assert.ok(filter);
  await act(async()=>{tree.root.findAllByType('button').find(b=>b.props.children==='تاجر تجريبي').props.onClick();});
  text=JSON.stringify(tree.toJSON());assert.ok(text.includes('تاريخ التأكيد:'));assert.ok(text.includes('رقم الهاتف'));
  // Close details and open creation, using real component handlers with a fake API.
  await act(async()=>{tree.root.findAll(n=>n.type===uiNames.Dialog&&n.props.open)[0].props.onOpenChange(false);tree.root.findAllByType('button').find(b=>React.Children.toArray(b.props.children).some(c=>typeof c==='string'&&c.includes('إضافة مستخدم'))).props.onClick();});
  assert.equal(tree.root.findAllByType('input').find(i=>i.props.id==='admin-phone').props.type,'tel');
  for(const [id,value] of [['admin-username','new_owner'],['admin-email','new@example.test'],['admin-full_name','صاحب متجر'],['admin-phone','٠٩١ ٢٣٤-٥٦٧٨'],['admin-create-password','test-only-password']])await act(async()=>{tree.root.findAllByType('input').find(i=>i.props.id===id).props.onChange({target:{value}})});
  await act(async()=>{tree.root.findByType('form').props.onSubmit({preventDefault(){}});await tick()});assert.equal(sent.action,'create');assert.equal(sent.payload.phone,'0912345678');assert.equal(sent.payload.username,'new_owner');await act(async()=>tree.unmount());
  // Public signup includes a labelled required telephone field and sends its normalized value.
  let signupArgs;const publicImports={...imports,
    'react-router-dom':{useNavigate:()=>()=>{}},
    '@/hooks/useAuth':{useAuth:()=>({user:null,loading:false,signIn:async()=>({}),signUp:async(...args)=>{signupArgs=args;return {error:null,needsEmailConfirmation:true}}})},
    '@/lib/loginRemember':{loadSavedLogin:()=>null,saveLogin:()=>{},clearSavedLogin:()=>{}},
    '@/lib/appSettings':{fetchAppSettings:async()=>null},
    '@/integrations/supabase/client':{supabase:{}},zod:require('zod'),
  };
  const login={exports:{},require:name=>publicImports[name]||load(name),console};vm.runInNewContext(compile('src/pages/Login.tsx'),login);
  await act(async()=>{tree=create(React.createElement(login.exports.default));await tick()});
  const signupPhone=tree.root.findAllByType('input').find(i=>i.props.id==='signup-phone');assert.equal(signupPhone.props.required,true);assert.equal(signupPhone.props.autoComplete,'tel');
  for(const [id,value] of [['fullname','Test Owner'],['username','new_store'],['signup-phone','٠٩١ ٢٣٤-٥٦٧٨'],['email-up','new@example.test'],['password-up','test-only-password']])await act(async()=>{tree.root.findAllByType('input').find(i=>i.props.id===id).props.onChange({target:{value}})});
  await act(async()=>{await tree.root.findAllByType('form')[1].props.onSubmit({preventDefault(){}})});assert.equal(signupArgs[4],'0912345678');assert.ok(JSON.stringify(tree.toJSON()).includes('تأكيد'));await act(async()=>tree.unmount());
  console.log('PASS account UI: independent email badges, confirmation date, saved telephone shown, required telephone inputs, normalized phone sent by both creation forms.');
})().catch(e=>{console.error(e);process.exitCode=1});
