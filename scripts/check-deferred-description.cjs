// Exercise the actual effect without a browser, database writes, or network calls.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const source=fs.readFileSync(__dirname+'/../src/pages/LandingPage.tsx','utf8'),ast=ts.createSourceFile('LandingPage.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let effect;
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0]?.getText(ast).includes('const deferred = ssrSeed?.deferredDescription;'))effect=node.arguments[0].getText(ast);ts.forEachChild(node,visit);}visit(ast);assert.ok(effect);
async function fixture({pageDescription='',fail=false,noObserver=false}={}){
 const reads=[],statuses=[];let product={id:'p1',description:''},intersect,cleanup;
 const context={
   exports:{},AbortController,ssrSeed:{deferredDescription:{productId:'p1',landingPageId:'lp1'}},
   descriptionPlaceholderRef:{current:{}},setDescriptionStatus:s=>statuses.push(s),setProduct:fn=>{product=fn(product)},
   supabase:{from:table=>{
     reads.push(table);
     return {select(){return this},eq(){return this},abortSignal(signal){this.signal=signal;return this},
       async maybeSingle(){return {data:{description:table==='landing_pages'?pageDescription:'<p>Product details</p>'},error:fail?Error('offline'):null};}
     };
   }},
 };
 if(!noObserver)context.IntersectionObserver=class {constructor(fn){intersect=fn}observe(){}disconnect(){}};
 vm.runInNewContext(ts.transpileModule('exports.effect = '+effect,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);cleanup=context.exports.effect();
 return {reads,statuses,getProduct:()=>product,intersect:()=>intersect([{isIntersecting:true}]),cleanup,settle:()=>new Promise(r=>setImmediate(r))};
}
(async()=>{
 const delayed=await fixture();assert.equal(delayed.reads.length,0);delayed.intersect();await delayed.settle();assert.deepEqual(delayed.reads,['landing_pages','products']);assert.equal(delayed.getProduct().description,'<p>Product details</p>');assert.equal(delayed.statuses.at(-1),'ready');delayed.intersect();assert.equal(delayed.reads.length,2,'Repeated intersections fetch once');
 const override=await fixture({pageDescription:'<p>Page override</p>'});override.intersect();await override.settle();assert.deepEqual(override.reads,['landing_pages']);assert.equal(override.getProduct().description,'<p>Page override</p>');
 const failed=await fixture({fail:true});failed.intersect();await failed.settle();assert.equal(failed.statuses.at(-1),'error');
 const retry=await fixture();retry.intersect();await retry.settle();assert.equal(retry.statuses.at(-1),'ready');
 const cancelled=await fixture();cancelled.intersect();cancelled.cleanup();await cancelled.settle();assert.equal(cancelled.getProduct().description,'');
 const fallback=await fixture({noObserver:true});await fallback.settle();assert.equal(fallback.statuses.at(-1),'ready');
 console.log('PASS deferred descriptions: proximity loading, page override/product fallback, single fetch, visible failure state, retry, cancellation and no-observer fallback.');
})().catch(e=>{console.error(e);process.exitCode=1});
