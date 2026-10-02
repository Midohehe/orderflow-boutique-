const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const source = fs.readFileSync('supabase/functions/courier-account/index.ts', 'utf8').replace(/^import .*\r?\n/, '');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
async function run(options = {}) {
  let handler, created, reset, deleted;
  let accountReads = 0;
  const admin = {
    auth: {
      getUser: async () => ({ data: { user: options.unauthorized ? null : { id: 'caller' } }, error: null }),
      admin: {
        createUser: async input => { created = input; return { data: { user: { id: 'new-user' } }, error: null }; },
        updateUserById: async (...input) => { reset = input; return { error: null }; },
        deleteUser: async id => { deleted = id; return { error: null }; },
      },
    },
    from(table) {
      let insert = false;
      const result = () => {
        if (table === 'couriers') return { data: { id: 'courier', name: 'Courier', store_id: 'store' }, error: null };
        if (table === 'stores') return { data: { owner_id: options.otherOwner ? 'other' : 'caller' }, error: null };
        if (table === 'user_roles') return { data: options.admin ? [{ role: 'admin' }] : [], error: null };
        if (insert) return { error: options.linkFail ? { message: 'conflict' } : null };
        accountReads++;
        return { data: options.existing ? { user_id: 'existing-user', username: 'existing' } : options.committed && accountReads > 1 ? { user_id: 'new-user' } : null, error: null };
      };
      const builder = { select: () => builder, eq: () => builder, single: async () => result(), maybeSingle: async () => result(), insert: () => { insert = true; return builder; }, then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject) };
      return builder;
    },
  };
  vm.runInNewContext(js, { createClient: () => admin, Deno: { env: { get: () => 'test' }, serve: fn => { handler = fn; } }, Response });
  const response = await handler(new Request('https://test.invalid', { method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ courier_id: 'courier', action: options.action || 'create', username: options.username || 'Driver_One', password: 'test-password-123' }) }));
  return { response, created, reset, deleted };
}
(async () => {
  assert.equal((await run({ unauthorized: true })).response.status, 401);
  assert.equal((await run({ otherOwner: true })).response.status, 403);
  assert.equal((await run({ username: 'bad@name' })).response.status, 400);
  assert.equal((await run({ existing: true })).response.status, 409);
  const valid = await run();
  assert.equal(valid.response.status, 200);
  assert.equal(valid.created.email, 'driver_one@couriers.wasla.invalid');
  assert.equal(valid.created.app_metadata.account_type, 'courier');
  assert.equal(valid.created.user_metadata.sub_user, true);
  assert.equal((await run({ otherOwner: true, admin: true })).response.status, 200);
  assert.equal((await run({ action: 'reset_password', existing: true })).reset[0], 'existing-user');
  assert.equal((await run({ linkFail: true })).deleted, 'new-user');
  const uncertain = await run({ linkFail: true, committed: true });
  assert.equal(uncertain.response.status, 200);
  assert.equal(uncertain.deleted, undefined);
  console.log('Courier accounts: authentication, owner/admin authorization, username validation, trusted metadata, password reset and failure cleanup passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
