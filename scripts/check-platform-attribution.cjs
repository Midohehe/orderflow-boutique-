const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const storage=new Map();const ctx={exports:{},URLSearchParams,sessionStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/platformAttribution.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);
const {capturePlatformAttribution:capture,readPlatformAttribution:read}=ctx.exports;
assert.equal(read(),undefined);capture('?utm_source=facebook&utm_medium=paid_social&utm_campaign=launch&email=secret@example.test&password=private&token_hash=secret&fbclid=click');
let result=read();assert.deepEqual(Object.keys(result),['utm_source','utm_medium','utm_campaign']);assert.equal(result.utm_source,'facebook');assert.ok(!JSON.stringify([...storage.values()]).includes('secret'));capture('');assert.equal(read().utm_campaign,'launch');
capture('?utm_source=instagram&utm_content='+encodeURIComponent('x'.repeat(500)));assert.equal(read().utm_source,'instagram');assert.equal(read().utm_content.length,200);assert.equal(read().utm_campaign,undefined);
ctx.sessionStorage.getItem=()=>'{bad-json';assert.equal(read(),undefined);ctx.sessionStorage.getItem=()=>{throw Error('storage denied')};ctx.sessionStorage.setItem=()=>{throw Error('storage denied')};assert.doesNotThrow(()=>capture('?utm_source=facebook'));assert.equal(read(),undefined);
console.log('PASS platform attribution: campaign survives navigation, latest tagged visit, bounded allowlist, no form/token storage, denied/corrupt storage safe.');
