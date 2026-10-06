const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
let rows = [];
let failure = null;
class Query {
  constructor(table) { this.table = table; this.filters = []; this.head = false; }
  select(_, options) { this.head = !!options?.head; return this; }
  eq(k,v) { this.filters.push(r => r[k] === v); return this; }
  in(k,v) { this.filters.push(r => v.includes(r[k])); return this; }
  ilike(k,v) { this.filters.push(r => typeof r[k] === 'string' && r[k].toUpperCase() === v.toUpperCase()); return this; }
  or(expression) {
    this.filters.push(row => expression.split(",").some(part => {
      const [key,op,value] = part.split(".");
      if(op === "is" && value === "null") return row[key] == null;
      if(op === "eq") return row[key] === value.replace(/^"|"$/g,'');
      throw Error("Unexpected predicate: "+part);
    }));
    return this;
  }
  order() { return this; }
  range(from,to) { this.bounds = [from,to]; return this; }
  maybeSingle() { this.single = true; return this; }
  then(resolve,reject) {
    const matches = this.table === "orders" ? rows.filter(row=>this.filters.every(fn=>fn(row))) : [];
    const data = this.head ? null : this.single ? null : this.bounds ? matches.slice(this.bounds[0],this.bounds[1]+1) : matches;
    return Promise.resolve({data,count:matches.length,error:this.table === "orders" ? failure : null}).then(resolve,reject);
  }
}
const supabase = {from:table=>new Query(table),rpc:()=>Promise.resolve({ data:{statusCounts:{pending:rows.filter(row=>row.store_id==='store-a' && !row.is_deleted && row.status==='pending' && !row.country_review_required).length,shipped:3},confirmationCounts:{},deletedCount:0},error:null })};
function load(file, imports) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname,"../src/lib",file),"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText;
  const exports={};
  vm.runInNewContext(source,{exports,require:name=>{
    if(!(name in imports)) throw Error("Unexpected import "+name);
    return imports[name];
  }});
  return exports;
}
const queries = load("ordersQuery.ts",{"@/integrations/supabase/client":{supabase}});
const meta = load("ordersPageMeta.ts",{
  "@/integrations/supabase/client":{supabase},
  "@/lib/ordersQuery":queries,
  "@/lib/carrierMappingsForStore":{carrierMappingsFromRows:()=>[],fetchMergedCarrierMappingRows:async()=>[]},
  "@/lib/deliveryStatsRpc":{fetchShippedCarrierCounts:async()=>({})},
  "@/lib/missedOrders":{fetchMissedOrdersCount:async()=>0},
});
async function main() {
  const base = {store_id:"store-a",is_deleted:false,status:"pending"};
  rows = [
    ...[null,"LY","ly",null,"LY","ly"].map((country_code,id)=>({...base,id,country_code})),
    ...["EG","TN","DZ","US","TR"].map((country_code,id)=>({...base,id:10+id,country_code})),
    {...base,id:20,country_code:"LY",is_deleted:true},
    {...base,id:21,country_code:"LY",store_id:"another-store"},
    {...base,id:22,country_code:"LY",status:"shipped"},
  ];
  rows = rows.map(row=>({...row,country_review_required:![null,'LY','ly'].includes(row.country_code)}));
  const count = await queries.fetchOrdersTabCount("store-a","pending");
  const page = await queries.fetchOrdersPage("store-a","pending",1,2);
  assert.equal(count,6);
  assert.equal(page.total,count);
  assert.equal(page.rows.length,2); // Badge counts the tab, not only the current page.
  const result = await meta.fetchOrdersPageMeta("store-a",null);
  assert.equal(result.statusCounts.pending,6); // Never use the RPC's combined 11.
  assert.equal(result.statusCounts.shipped,3);
  assert.equal((await queries.fetchOrdersPage('store-a','foreign',1,50)).total,5);
  rows.find(row=>row.country_code==='EG').country_review_required=false;
  assert.equal(await queries.fetchOrdersTabCount('store-a','pending'),7);
  const egypt=await queries.fetchOrdersPage('store-a','pending',1,50,{countryCode:'EG'});
  assert.equal(egypt.total,1);assert.equal(egypt.rows[0].country_code,'EG');
  assert.equal((await queries.fetchOrdersPage('store-a','pending',1,50,{countryCode:'LY'})).total,4,'case-insensitive legacy country codes');
  assert.equal((await queries.fetchOrdersPage('store-a','pending',1,50,{countryCode:'unknown'})).total,2);
  assert.equal((await queries.fetchAllOrdersForExport('store-a','pending',{countryCode:'EG'})).length,1,'Excel uses same country filter');
  assert.equal((await queries.fetchOrdersPage('store-a','foreign',1,50)).total,4,'accepted country remains intact but leaves review');
  await assert.rejects(queries.fetchOrdersPage('store-a','pending',1,50,{countryCode:'SA,LY'}),/رمز/);
  rows.find(row=>row.country_code==='EG').country_review_required=true;
  rows = rows.filter(row=>row.country_code==="EG");
  assert.equal((await meta.fetchOrdersPageMeta("store-a",null)).statusCounts.pending,0);
  failure = new Error("Query failed");
  await assert.rejects(queries.fetchOrdersTabCount("store-a","pending"),/Query failed/);
  console.log("PASS pending/review queries: matching badge/list totals, accepted foreign country preservation, country filter and Excel, unknown/legacy codes, pagination, store scope, deletion, zero and errors");
}
main().catch(e=>{console.error(e);process.exitCode=1});
