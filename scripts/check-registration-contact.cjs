const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const phones={exports:{}};vm.runInNewContext(compile('supabase/functions/_shared/contact-phone.ts'),phones);
const {normalizeContactPhone, isValidContactPhone}=phones.exports;
for(const [input,expected] of [['٠٩١ ٢٣٤-٥٦٧٨','0912345678'],['۰۰۲۱۸ ۹۱ ۲۳۴۵۶۷۸','+218912345678'],[' +218 (91) 234-5678 ','+218912345678']]){assert.equal(normalizeContactPhone(input),expected);assert.equal(isValidContactPhone(expected),true);}
for(const input of ['', '123', '091hello1234567','++218912345678','1234567890123456','javascript:1234567'])assert.equal(isValidContactPhone(normalizeContactPhone(input)),false);
let payload;
const auth={signUp:async p=>{payload=p;return {data:{user:{id:'fixture'},session:null},error:null}}};
const modules={
  'react':{createContext:()=>({Provider:'Provider'}),useState:()=>[null,()=>{}],useEffect:()=>{}},
  'react/jsx-runtime':{jsx:(type,props)=>({type,props})},
  '@/integrations/supabase/client':{supabase:{auth}},
  '@/lib/registrationPixel':{sendCompletedRegistration:()=>{}},
  'react-router-dom':{useLocation:()=>({pathname:'/login'})},
  '@tanstack/react-query':{useQueryClient:()=>({clear(){}})},
  '@/lib/contactPhone':phones.exports,
};
const context={exports:{},require:name=>{if(!modules[name])throw Error(name);return modules[name]},window:{location:{origin:'https://example.test'}}};
vm.runInNewContext(compile('src/hooks/useAuth.tsx'),context);
(async()=>{
  const provider=context.exports.AuthProvider({children:null});
  const result=await provider.props.value.signUp('owner@example.test','test-only-password','fixture_store','Test Owner','٠٩١ ٢٣٤-٥٦٧٨');
  assert.equal(payload.options.data.contact_phone,'0912345678');assert.equal(payload.options.data.platform_signup,true);assert.equal(payload.options.data.username,'fixture_store');assert.equal(payload.options.data.full_name,'Test Owner');assert.equal(payload.options.emailRedirectTo,'https://example.test/auth/confirm');assert.equal(result.needsEmailConfirmation,true);assert.equal('phone' in payload,false,'Contact number must not change Auth login/OTP behavior');
  const userHelpers={exports:{},require:()=>({})};vm.runInNewContext(compile('src/lib/adminUsers.ts'),userHelpers);
  const {emailStatus}=userHelpers.exports;assert.equal(emailStatus({email:'x@example.test',email_confirmed_at:'2026-10-01',status:'disabled'}),'confirmed');assert.equal(emailStatus({email:'x@example.test',email_confirmed_at:null,status:'disabled'}),'unconfirmed');assert.equal(emailStatus({email:null,email_confirmed_at:'2026-10-01'}),'not_applicable');
  console.log('PASS: Arabic/Persian phone normalization; invalid values; signup contact persistence; email confirmation flow and Pixel metadata preserved; independent email confirmation status.');
})().catch(e=>{console.error(e);process.exitCode=1});
