const fs=require('node:fs');
const assert=require('node:assert/strict');
const ref='sukehkrhvasfnoheyvvx';
const envPath=process.env.WASLA_ACCESS_ENV;if(!envPath)throw Error('WASLA_ACCESS_ENV required');
const settings=Object.fromEntries(fs.readFileSync(envPath,'utf8').split(/\r?\n/).filter(l=>/^\w+=/.test(l)).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
assert.equal(settings.SUPABASE_PROJECT_REF,ref);
(async()=>{
 const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`,{headers:{Authorization:`Bearer ${settings.SUPABASE_ACCESS_TOKEN}`},redirect:'error'});assert.ok(r.ok);
 const key=(await r.json()).find(x=>x.name==='anon')?.api_key;assert.ok(key);
 const slugs=['mazbot-poll','process-confirmation-reminders','whatsapp-ai-reply','whatsapp-send-confirmation','whatsapp-share','whatsapp-send','whatsapp-classify-intent','whatsapp-webhook'];
 const responses=await Promise.all(slugs.map(async slug=>{
  const response=await fetch(`https://${ref}.supabase.co/functions/v1/${slug}`,{method:'POST',headers:{Authorization:`Bearer ${key}`,apikey:key,'Content-Type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200,slug);const body=await response.json();assert.equal(body.skipped,true);assert.equal(body.reason,'whatsapp_disabled');assert.equal(body.ok,false);
  return {slug,status:'disabled_verified'};
 }));
 const invalid=await fetch(`https://${ref}.supabase.co/functions/v1/create-order`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"request_id":"invalid"}',redirect:'error',signal:AbortSignal.timeout(30000)});
 assert.equal(invalid.status,400,'Invalid checkout must be rejected without creating an order');
 console.log(JSON.stringify({whatsapp:responses,invalidCheckout:'rejected'},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
