const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || path.resolve('../test-deps/node_modules/@electric-sql/pglite'));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
(async () => {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE stores(id uuid PRIMARY KEY); CREATE TABLE products(id uuid PRIMARY KEY);
    CREATE FUNCTION has_store_access(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT $1::text=current_setting(''test.store'',true)';
    CREATE TABLE orders(id uuid PRIMARY KEY, store_id uuid REFERENCES stores, updated_at timestamptz DEFAULT now(),
      status text DEFAULT 'pending', is_deleted boolean DEFAULT false, locked_insufficient_balance boolean DEFAULT false,
      shipping_reference text, shipping_id bigint, shipped_to_company boolean DEFAULT false, shipping_error text,
      carrier_status text, carrier_status_updated_at timestamptz, price numeric DEFAULT 45, shipping_fee numeric DEFAULT 10,
      quantity integer DEFAULT 1, product_id uuid, customer_name text, phone text, address text, city text, governorate text, currency_code text DEFAULT 'SAR', selected_color text, selected_size text, selected_product_code text);
    CREATE TABLE order_items(id uuid PRIMARY KEY, order_id uuid REFERENCES orders ON DELETE CASCADE, quantity integer);
    CREATE TABLE courier_orders(order_id uuid PRIMARY KEY, state text);
    CREATE FUNCTION update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
    CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    INSERT INTO auth.users VALUES ('${id(1)}'); INSERT INTO stores VALUES ('${id(2)}'),('${id(3)}');
    INSERT INTO orders(id,store_id) SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${id(2)}' FROM generate_series(10,20) n;
    INSERT INTO order_items VALUES ('${id(99)}','${id(10)}',1);`);
  await db.exec(fs.readFileSync('supabase/migrations/20261006120000_cod_network_shipping.sql', 'utf8'));
  const one = async (sql, args=[]) => (await db.query(sql,args)).rows[0];
  const claim = async (n, options={}) => {
    const order = await one('SELECT updated_at FROM orders WHERE id=$1',[id(n)]);
    const config = await one('SELECT updated_at FROM store_cod_network_settings WHERE store_id=$1',[id(2)]);
    return (await one('SELECT claim_cod_network_order($1,$2,$3,$4,$5,$6) AS result',
      [id(n),id(2),id(1),options.revision || order.updated_at,config.updated_at,JSON.stringify({items:[{sku:'SKU',quantity:1,price:55}]})])).result;
  };
  const finish = async (n, attempt, state, remote=null) => (await one('SELECT finish_cod_network_order($1,$2,$3,$4,$5,$6) AS ok',[id(n),attempt,state,remote,remote ? `COD-${remote}` : null,'test result'])).ok;
  await assert.rejects(db.query('SELECT save_cod_network_settings($1,true,$2,$3)',[id(2),'SA','SAR']), /API Token/);
  await db.query('SELECT save_cod_network_settings($1,true,$2,$3,$4)',[id(2),'SA','SAR','fixture-secret-token']);
  await db.query('SELECT save_cod_network_settings($1,false,$2,$3,$4)',[id(3),'SA','SAR',null]);
  await db.exec(`SET ROLE authenticated; SET test.store='${id(2)}';`);
  assert.equal((await db.query('SELECT * FROM store_cod_network_settings')).rows.length,1);
  await assert.rejects(db.query('SELECT * FROM cod_network_credentials'),/permission denied/);
  await assert.rejects(db.query('SELECT * FROM cod_network_shipments'),/permission denied/);
  await assert.rejects(db.query(`SELECT reserve_legacy_shipping_order('${id(10)}')`),/permission denied/);
  await db.exec('RESET ROLE');
  await assert.rejects(claim(10,{revision:'2000-01-01T00:00:00Z'}),/تغير الطلب/);
  const claimed = await claim(10); assert.equal(claimed.state,'claimed');
  assert.equal((await claim(10)).state,'uncertain','second request cannot POST again');
  assert.equal((await one('SELECT reserve_legacy_shipping_order($1) AS ok',[id(10)])).ok,false);
  await assert.rejects(db.query('UPDATE orders SET price=99 WHERE id=$1',[id(10)]),/تحقق/);
  await assert.rejects(db.query('DELETE FROM orders WHERE id=$1',[id(10)]),/تحقق/);
  await assert.rejects(db.query('UPDATE order_items SET quantity=9 WHERE order_id=$1',[id(10)]),/تحقق/);
  await assert.rejects(db.query('INSERT INTO order_items VALUES ($1,$2,1)',[id(98),id(10)]),/تحقق/);
  assert.equal(await finish(10,id(999),'sent','51'),false,'stale attempt cannot finalize');
  assert.equal(await finish(10,claimed.attempt_id,'uncertain'),true);
  assert.equal((await claim(10)).state,'uncertain');
  assert.equal(await finish(10,claimed.attempt_id,'sent','51'),true);
  assert.equal((await claim(10)).state,'sent');
  const shipped = await one('SELECT * FROM orders WHERE id=$1',[id(10)]);
  assert.equal(shipped.shipping_provider,'cod_network'); assert.equal(shipped.status,'shipped');
  assert.equal(shipped.shipping_id,null); assert.equal(shipped.shipping_reference,'COD-51');
  assert.equal(shipped.price,'45'); assert.equal(shipped.shipping_fee,'10');
  const failed = await claim(11); await finish(11,failed.attempt_id,'failed');
  assert.equal((await one('SELECT shipping_provider FROM orders WHERE id=$1',[id(11)])).shipping_provider,null);
  assert.notEqual((await claim(11)).attempt_id,failed.attempt_id,'known failure can claim a fresh attempt');
  assert.equal((await one('SELECT reserve_legacy_shipping_order($1) AS ok',[id(12)])).ok,true);
  await assert.rejects(claim(12),/مسند/);
  await db.query('INSERT INTO courier_orders VALUES ($1,$2)',[id(13),'assigned']);
  await assert.rejects(claim(13),/مسند/);
  const before = (await one('SELECT updated_at FROM orders WHERE id=$1',[id(14)])).updated_at;
  await db.query('INSERT INTO order_items VALUES ($1,$2,1)',[id(97),id(14)]);
  await assert.rejects(claim(14,{revision:before}),/تغير الطلب/);
  await db.query('SELECT save_cod_network_settings($1,false,$2,$3)',[id(2),'SA','SAR']);
  await assert.rejects(claim(15),/غير مفعلة/);
  assert.equal((await one('SELECT api_token FROM cod_network_credentials WHERE store_id=$1',[id(2)])).api_token,'fixture-secret-token');
  await db.close();
  console.log('PASS COD Network DB: private credentials, store RLS, restricted RPCs, review revisions, duplicate and cross-provider guards, frozen in-flight orders/items, known-failure retry, uncertain recovery and exact final order state.');
})().catch(error => { console.error(error); process.exitCode=1; });
