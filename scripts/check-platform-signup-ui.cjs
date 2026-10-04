const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict'),Module=require('module');
const deps=process.env.REACT_TEST_DEPS||path.resolve('../test-deps/node_modules');
const React=require(path.join(deps,'react'));const original=Module._load;Module._load=function(n,...a){return n==='react'?React:original.call(this,n,...a)};
const {act,create}=require(path.join(deps,'react-test-renderer'));
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const host=tag=>props=>React.createElement(tag,props,props.children);
let user=null,authLoading=false,calls=[],navigateTo=null,signup=async()=>({error:null,needsEmailConfirmation:true}),notices=[],savedCalls=[],failedLoad=false;
const imports={react:React,'react/jsx-runtime':require('react/jsx-runtime'),zod:require('zod'),
 'lucide-react':new Proxy({},{get:()=>()=>null}),
 'react-router-dom':{Link:props=>React.createElement('a',{...props,href:props.to},props.children),useNavigate:()=>value=>{navigateTo=value}},
 '@/hooks/useAuth':{useAuth:()=>({user,loading:authLoading,signUp:async(...args)=>{calls.push(args);return signup()}})},
 '@/hooks/use-toast':{toast:value=>notices.push(value)},
 '@tanstack/react-query':{useQueryClient:()=>({setQueryData(){},invalidateQueries:async()=>{}})},
};
function load(file){const c={exports:{},require:name=>{
 if(imports[name])return imports[name];
 if(name.endsWith('.css'))return {};
 if(name.includes('/components/ui/'))return new Proxy({},{get:(_,key)=>({Button:host('button'),Input:host('input'),Label:host('label'),Textarea:host('textarea')}[key]||host('div'))});
 throw Error('Missing module '+name);
 },structuredClone,URLSearchParams,console,setTimeout,clearTimeout,window:{addEventListener(){},removeEventListener(){}},navigator:{clipboard:{writeText:async()=>{}}}};vm.runInNewContext(compile(file),c);return c.exports;}
imports['./contactPhone']=load('supabase/functions/_shared/contact-phone.ts');
imports['@/lib/storeRegistration']=load('src/lib/storeRegistration.ts');
imports['@/lib/platformSignupContent']=load('src/lib/platformSignupContent.ts');
const Form=load('src/components/StoreSignupForm.tsx').default;imports['./StoreSignupForm']={default:Form};
const View=load('src/components/PlatformSignupView.tsx').default;imports['./PlatformSignupView']={default:View};
const defaults=imports['@/lib/platformSignupContent'].defaultSignupContent;
imports['@/lib/platformSignupPage']={fetchSignupPageEditor:async()=>{if(failedLoad)throw Error('offline');return {draft:structuredClone(defaults),published:null,revision:0,published_at:null}},saveSignupPage:async(content,publish,revision)=>{savedCalls.push({content,publish,revision});return revision+1;}};
const Editor=load('src/components/PlatformSignupEditor.tsx').default;
const text=node=>JSON.stringify(node.toJSON());
const button=(tree,label)=>tree.root.findAllByType('button').find(b=>React.Children.toArray(b.props.children).some(c=>typeof c==='string'&&c.includes(label)));
async function fill(tree){for(const [name,value] of Object.entries({fullName:' Test Owner ',username:'MY_STORE',phone:'٠٩١ ٢٣٤-٥٦٧٨',email:' owner@example.test ',password:'test-only-password'}))await act(async()=>tree.root.findAllByType('input').find(n=>n.props.name===name).props.onChange({target:{value}}));}
(async()=>{
 let tree;await act(async()=>{tree=create(React.createElement(Form,{ctaText:'أنشئ متجرك الآن'}))});
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(calls.length,0);assert.equal(tree.root.findAllByType('input').filter(n=>n.props['aria-invalid']).length,5);
 await fill(tree);let finish;signup=()=>new Promise(resolve=>{finish=resolve});
 await act(async()=>{const handler=tree.root.findByType('form').props.onSubmit;handler({preventDefault(){}});handler({preventDefault(){}});await tick()});
 assert.equal(calls.length,1);assert.equal(tree.root.findByType('fieldset').props.disabled,true);assert.deepEqual(calls[0],['owner@example.test','test-only-password','my_store','Test Owner','0912345678']);
 await act(async()=>{finish({error:null,needsEmailConfirmation:true});await tick()});assert.ok(text(tree).includes('أكّد بريدك'));assert.ok(!text(tree).includes('test-only-password'));assert.equal(navigateTo,null);await act(async()=>tree.unmount());
 calls=[];await act(async()=>{tree=create(React.createElement(Form,{ctaText:'إنشاء',preview:true}))});await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(calls.length,0);assert.equal(tree.root.findByType('fieldset').props.disabled,true);await act(async()=>tree.unmount());
 user={id:'existing'};await act(async()=>{tree=create(React.createElement(Form,{ctaText:'إنشاء'}))});assert.ok(text(tree).includes('/dashboard'));assert.equal(tree.root.findAllByType('form').length,0);await act(async()=>tree.unmount());user=null;
 signup=async()=>{throw Error('offline')};await act(async()=>{tree=create(React.createElement(Form,{ctaText:'إنشاء'}))});await fill(tree);await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.ok(text(tree).includes('تعذّر الاتصال'));assert.equal(tree.root.findByType('fieldset').props.disabled,false);
 signup=async()=>({error:null,needsEmailConfirmation:false});await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(navigateTo,'/dashboard');await act(async()=>tree.unmount());
 user={id:'admin'};await act(async()=>{tree=create(React.createElement(Editor));await tick()});assert.ok(text(tree).includes('https://www.was-la.com/register'));assert.ok(text(tree).includes('utm_source=facebook'));
 await act(async()=>tree.root.findAllByType('input').find(n=>n.props.id==='signup-edit-title').props.onChange({target:{value:'عنوان معدل'}}));assert.ok(text(tree).includes('تعديلات غير محفوظة'));
 await act(async()=>button(tree,'حفظ مسودة').props.onClick());assert.equal(savedCalls[0].publish,false);assert.equal(savedCalls[0].revision,0);assert.equal(savedCalls[0].content.title,'عنوان معدل');
 await act(async()=>button(tree,'معاينة الصفحة').props.onClick());assert.ok(text(tree).includes('عنوان معدل'));assert.equal(tree.root.findByType('form').findByType('fieldset').props.disabled,true);
 await act(async()=>button(tree,'هاتف').props.onClick());assert.ok(tree.root.findAll(n=>n.props.style?.maxWidth===390).length>0);
 await act(async()=>button(tree,'نشر التعديلات').props.onClick());assert.equal(savedCalls[1].publish,true);assert.equal(savedCalls[1].revision,1);assert.ok(notices.some(n=>n.title.includes('تم نشر')));
 await act(async()=>tree.unmount());failedLoad=true;await act(async()=>{tree=create(React.createElement(Editor));await tick()});assert.ok(text(tree).includes('تعذّر تحميل'));assert.equal(button(tree,'نشر التعديلات'),undefined);await act(async()=>tree.unmount());
 console.log('PASS signup UI: inline validation, normalized data, double-submit guard, confirmation success, session reuse, network recovery, no signup in preview, editable draft, responsive preview, publish revision, failed-load protection.');
})().catch(e=>{console.error(e);process.exitCode=1});
