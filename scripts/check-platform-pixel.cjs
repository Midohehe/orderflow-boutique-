const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const js = ts.transpileModule(fs.readFileSync('src/lib/platformPixel.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function setup(path='/') {
 const scripts=[];
 const paths={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/publicPaths.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,paths);
 const context={exports:{},require:()=>paths.exports,window:{location:{pathname:path}},document:{createElement:()=>({}),head:{appendChild:s=>scripts.push(s)}}};
 vm.runInNewContext(js,context);
 return {...context, scripts, api:context.exports};
}
const c=setup();
c.api.trackPlatformPageView('invalid','a');
assert.equal(c.scripts.length,0);
c.api.trackPlatformPageView('123456789','a');
c.api.trackPlatformPageView('123456789','a');
assert.equal(c.scripts.length,1);
assert.equal(c.window.fbq.queue.filter(x=>x[0]==='init').length,1);
assert.equal(c.window.fbq.queue.filter(x=>x[0]==='trackSingle').length,1);
c.window.location.pathname='/login';
c.api.trackPlatformPageView('123456789','b');
assert.equal(c.window.fbq.queue.filter(x=>x[0]==='trackSingle').length,2);
assert.equal(c.api.needsPixelDocumentReset('/p/test'),true);
assert.equal(c.api.needsPixelDocumentReset('/dashboard'),false);
assert.equal(c.api.needsPixelDocumentReset('/login'),false);
assert.equal(c.api.needsPixelDocumentReset('/register'),false);
for(const route of ['/register','/register/']){const signup=setup(route);signup.api.trackPlatformPageView('123456789','signup');assert.equal(signup.scripts.length,1);assert.equal(signup.window.fbq.queue.filter(x=>x[0]==='trackSingle').length,1);assert.equal(signup.window.fbq.queue.some(x=>x.includes('CompleteRegistration')),false);}
const p=setup('/p/test');
p.api.trackPlatformPageView('123456789','a');
assert.equal(p.scripts.length,0);
p.window.fbq=()=>{};
assert.equal(p.api.needsPixelDocumentReset('/login'),true);
assert.equal(p.api.needsPixelDocumentReset('/register'),true);
assert.equal(p.api.needsPixelDocumentReset('/p/test'),false);
console.log('Platform pixel checks passed: immediate load, deduplicated views, navigation, invalid IDs, merchant isolation.');
