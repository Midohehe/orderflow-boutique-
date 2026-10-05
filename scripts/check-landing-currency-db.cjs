const assert = require('node:assert/strict'), fs = require('node:fs');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  await db.exec(`CREATE TABLE landing_pages (id text PRIMARY KEY); CREATE TABLE orders (id text PRIMARY KEY);
    INSERT INTO landing_pages VALUES ('page-a'), ('page-b'); INSERT INTO orders VALUES ('old-order');`);
  await db.exec(fs.readFileSync('supabase/migrations/20261005160000_landing_page_currency.sql', 'utf8'));
  const currency = (table, id) => db.query(`SELECT currency_code FROM ${table} WHERE id=$1`, [id]).then(result => result.rows[0].currency_code);
  assert.equal(await currency('landing_pages', 'page-a'), null);
  assert.equal(await currency('orders', 'old-order'), null);
  await db.exec(`UPDATE landing_pages SET currency_code='USD' WHERE id='page-a';
    INSERT INTO orders VALUES ('new-order', 'USD');`);
  assert.equal(await currency('landing_pages', 'page-b'), null);
  await db.exec(`UPDATE landing_pages SET currency_code=NULL WHERE id='page-a';`);
  assert.equal(await currency('landing_pages', 'page-a'), null);
  assert.equal(await currency('orders', 'new-order'), 'USD');
  for (const code of ['ZZZ', '', 'usd']) {
    await assert.rejects(db.query(`UPDATE landing_pages SET currency_code=$1 WHERE id='page-a'`, [code]), /check constraint/);
    await assert.rejects(db.query(`UPDATE orders SET currency_code=$1 WHERE id='new-order'`, [code]), /check constraint/);
  }
  await db.close();
  console.log('PASS currency migration: legacy pages inherit, old orders untouched, page isolation, nullable reset, immutable historical denomination and invalid-code constraints.');
})().catch(error => { console.error(error); process.exitCode = 1; });
