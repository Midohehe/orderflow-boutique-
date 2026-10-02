const fs=require('fs');const assert=require('node:assert/strict');const {PGlite}=require(process.env.PGLITE_MODULE);
const base=fs.readFileSync('supabase/migrations/20260610120000_orders_delivery_stats_rpc.sql','utf8');
function extract(source,name){const start=source.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');assert.ok(start>=0,name);return source.slice(start,source.indexOf('$$;',start)+3);}
const sid='00000000-0000-0000-0000-000000000001',uid='00000000-0000-0000-0000-000000000002';
(async()=>{const db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;CREATE TABLE stores(id uuid PRIMARY KEY,owner_id uuid);INSERT INTO stores VALUES ('${sid}','${uid}');CREATE FUNCTION has_store_access(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM stores WHERE id=$1 AND owner_id=auth.uid()) $$;CREATE TABLE orders(store_id uuid,status text,confirmation_status text,is_deleted boolean DEFAULT false,country_code text,carrier_status text,carrier_status_raw jsonb);CREATE TABLE carrier_status_mappings(status_code text,custom_label text,category text,owner_id uuid,store_id uuid);CREATE TABLE user_roles(user_id uuid,role text);SET test.uid='${uid}';INSERT INTO carrier_status_mappings VALUES ('DEX','متابعة','in_progress','${uid}','${sid}');INSERT INTO orders(store_id,status,country_code) VALUES ('${sid}','pending',null),('${sid}','pending','LY'),('${sid}','pending','ly'),('${sid}','pending','EG'),('${sid}','with_courier','LY');INSERT INTO orders(store_id,status,is_deleted) VALUES ('${sid}','pending',true);`);
for(const n of ['_carrier_label_alias','_order_extract_carrier_code','_order_carrier_display_label','orders_shipped_carrier_counts'])await db.exec(extract(base,n));
await db.exec(extract(fs.readFileSync('supabase/migrations/20260618120000_carrier_mappings_user_only.sql','utf8'),'_merged_carrier_mappings'));
await db.exec(`INSERT INTO orders(store_id,status,carrier_status,carrier_status_raw) SELECT '${sid}','shipped',CASE WHEN i%3=0 THEN 'متابعة (DEX)' WHEN i%3=1 THEN 'Unmapped' ELSE null END,CASE WHEN i%3=0 THEN '{"status":"DEX"}'::jsonb ELSE null END FROM generate_series(1,3000)i;`);
const query=`SELECT * FROM orders_shipped_carrier_counts('${sid}', '${uid}') ORDER BY label`;
let t=performance.now();const before=(await db.query(query)).rows;const beforeMs=performance.now()-t;
await db.exec(fs.readFileSync('supabase/migrations/20261003090000_orders_page_performance.sql','utf8'));
t=performance.now();const after=(await db.query(query)).rows;const afterMs=performance.now()-t;
assert.deepEqual(after,before);
const c=(await db.query(`SELECT orders_page_counts('${sid}') AS c`)).rows[0].c;
assert.equal(c.statusCounts.pending,3);assert.equal(c.statusCounts.shipped,3000);assert.equal(c.statusCounts.with_courier,1);assert.equal(c.confirmationCounts.unconfirmed,3);assert.equal(c.deletedCount,1);
await db.exec(`SET test.uid='00000000-0000-0000-0000-000000000099'`);
await assert.rejects(db.query(`SELECT orders_page_counts('${sid}')`),/Access denied/);
assert.equal((await db.query(query)).rows.length,0);
console.log(JSON.stringify({test:'PASS counts, domestic/foreign/deleted, courier statuses, authorization and identical carrier labels',rows:3000,beforeMs:Math.round(beforeMs),afterMs:Math.round(afterMs)}));await db.close();})().catch(e=>{console.error(e);process.exitCode=1});
