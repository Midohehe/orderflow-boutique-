const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {createClient} = require('@supabase/supabase-js');
const ref = 'sukehkrhvasfnoheyvvx';
const envPath = process.env.WASLA_ACCESS_ENV;
if (!envPath) throw Error('WASLA_ACCESS_ENV is required');
const settings=Object.fromEntries(fs.readFileSync(envPath,'utf8').split(/\r?\n/).filter(l=>/^\w+=/.test(l)).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
assert.equal(settings.SUPABASE_PROJECT_REF,ref);
const backupDir=path.resolve('../../output/supabase-resource-fix/landing-backups');
fs.mkdirSync(backupDir,{recursive:true});
async function main(){
 const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`,{headers:{Authorization:`Bearer ${settings.SUPABASE_ACCESS_TOKEN}`},redirect:'error'});
 if(!r.ok)throw Error(`API keys HTTP ${r.status}`);
 const keys=await r.json();const key=keys.find(k=>k.name==='service_role')?.api_key;
 if(!key)throw Error('Service key unavailable');
 const sb=createClient(`https://${ref}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:ids,error}=await sb.from('landing_pages').select('id').like('description','%data:image/%');if(error)throw error;
 const summary=[];
 for(const {id} of ids){
  const {data:row,error:e}=await sb.from('landing_pages').select('id,owner_id,store_id,description,updated_at').eq('id',id).single();if(e)throw e;
  const filename=path.join(backupDir,id+'.json');if(!fs.existsSync(filename))fs.writeFileSync(filename,JSON.stringify(row),{flag:'wx'});
  let html=row.description;const matches=[...html.matchAll(/data:(image\/(?:png|jpeg|jpg|webp|gif|avif));base64,([a-zA-Z0-9+/=\r\n]+)/g)];
  let images=0;
  for(const match of matches){
   const bytes=Buffer.from(match[2].replace(/\s/g,''),'base64');
   const hash=crypto.createHash('sha256').update(bytes).digest('hex');
   const ext=match[1].split('/')[1].replace('jpeg','jpg');
   const objectPath=`${row.owner_id}/${row.store_id||'default'}/description-${hash}.${ext}`;
   if(match[1]==='image/avif'){
    const bucket=await sb.storage.getBucket('product-images');if(bucket.error)throw bucket.error;
    const allowed=bucket.data.allowed_mime_types;
    if(allowed&&!allowed.includes('image/avif')&&!allowed.includes('image/*')){
     const changed=await sb.storage.updateBucket('product-images',{public:bucket.data.public,allowedMimeTypes:[...allowed,'image/avif']});
     if(changed.error)throw changed.error;
    }
   }
   const upload=await sb.storage.from('product-images').upload(objectPath,bytes,{contentType:match[1],cacheControl:'31536000',upsert:false});
   if(upload.error&&!/already exists|duplicate/i.test(upload.error.message))throw upload.error;
   const url=sb.storage.from('product-images').getPublicUrl(objectPath).data.publicUrl;
   const check=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!check.ok)throw Error(`Image verification HTTP ${check.status}`);
   assert.equal(crypto.createHash('sha256').update(Buffer.from(await check.arrayBuffer())).digest('hex'),hash);
   html=html.split(match[0]).join(url);images++;
  }
  if(html===row.description)continue;
  if(process.argv.includes('--apply')){
   const update=await sb.from('landing_pages').update({description:html}).eq('id',id).eq('updated_at',row.updated_at).select('id');
   if(update.error)throw update.error;if(update.data?.length!==1)throw Error('Concurrent edit: page not overwritten');
   const verify=await sb.from('landing_pages').select('description').eq('id',id).single();if(verify.error)throw verify.error;assert.equal(verify.data.description,html);
  }
  summary.push({id,images,before:Buffer.byteLength(row.description),after:Buffer.byteLength(html),applied:process.argv.includes('--apply')});
  console.log(JSON.stringify(summary.at(-1)));
 }
 fs.writeFileSync(path.join(backupDir,`summary-${Date.now()}.json`),JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
