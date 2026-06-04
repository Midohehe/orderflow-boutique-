# Business Improvement Report
## Orderflow Boutique (وصلة) — Shipping & Financial Systems Audit

**Prepared as:** Business Analyst / ERP Consultant review  
**Scope:** Shipping operations, order lifecycle, financial controls, dashboards, merchant accounting, automation  
**Codebase version:** Current `main` branch audit (June 2026)  
**Data note:** Status counts, dwell times, and stuck-order metrics require production database queries. This report documents the **as-implemented model**, **design gaps**, and **recommended SQL/KPI definitions** to run against live data.

---

## Executive Summary

Orderflow Boutique is a capable multi-store e-commerce ERP with strong operational depth (confirmation center, prep lists, carrier sync, settlements, safes, ad wallets). However, the shipping lifecycle and financial layer show **architectural fragmentation**:

- **Three parallel status dimensions** (`orders.status`, `confirmation_status`, `prep_status`, plus free-text `carrier_status`) without a unified state machine.
- **Carrier delivery does not update local order status** — `delivered` is manual, creating reconciliation gaps.
- **Two P&L implementations disagree** on whether `settled` orders count as revenue.
- **No commission engine**, **no shipping-fee impact on profit**, and **no merchant payout workflow**.
- **Dashboards are operational, not executive** — one live chart exists; financial charts are coded but not rendered.

**Top 5 actions by impact:**

| Priority | Action | Impact |
|----------|--------|--------|
| P0 | Fix confirmation reminder bug (`pending` vs `unconfirmed`) | Reminders never fire |
| P0 | Fix ad wallet topup double-deduction on safes | Direct financial loss |
| P0 | Unify P&L: include `settled`, align COGS source | Management reporting trust |
| P1 | Implement unified order state machine + SLA timers | Operations visibility |
| P1 | Build executive dashboard + shipping KPI layer | Decision-making |

---

## 1. Shipping Operations Review

### 1.1 Current Order Lifecycle (As Implemented)

The system tracks **four independent dimensions**:

| Dimension | Field | Purpose |
|-----------|-------|---------|
| **Order status** | `orders.status` | Merchant-facing lifecycle |
| **Confirmation** | `orders.confirmation_status` | Customer confirmation workflow |
| **Preparation** | `orders.prep_status` | Warehouse prep sub-state |
| **Carrier** | `orders.carrier_status` | Free-text label from Turbo/Accurate codes |

```
[Created] status=pending, confirmation=unconfirmed, prep=pending
    │
    ├─► Confirmation Center / WhatsApp
    │       confirmed | no_answer | postponed | cancelled
    │
    ├─► Prep List → prep_status: preparing → prepared
    │
    ├─► ship-orders → status=shipped, carrier_status="طلب شحن"
    │
    ├─► Carrier sync/webhook → carrier_status updates (20+ codes)
    │       UPKBD/UKDB/UPKBL → status=unpacked (auto)
    │       RTRN/RCV → status=returned_received (auto)
    │       DTR* (delivered) → NO status change (by design)
    │
    ├─► Manual → status=delivered
    │
    └─► Settlement received → status=settled, settlement_received=true
```

**Key files:** `src/pages/Orders.tsx`, `supabase/functions/ship-orders/index.ts`, `supabase/functions/sync-carrier-statuses/index.ts`, `supabase/functions/carrier-webhook/index.ts`, `supabase/functions/receive-settlement/index.ts`

---

### 1.2 Status Inventory

#### A. `orders.status` (primary)

| Status | Arabic Label | Set By | Terminal? |
|--------|--------------|--------|-------------|
| `pending` | قيد الانتظار | Order creation (default) | No |
| `processing` | قيد المعالجة | **Never set in code** | — |
| `shipped` | جاري التوصيل | `ship-orders` edge function | No |
| `delivered` | تم الاستلام | Manual UI only | No |
| `settled` | تم استلام القيمة المالية | Settlement confirm | Yes |
| `cancelled` | ملغي | Confirmation cancel, AI cancel, stock strict mode | Yes |
| `unpacked` | تم التفريغ | Carrier UPKBD/UKDB/UPKBL auto | Yes |
| `returned_received` | تم استلام المرتجع | Carrier RTRN/RCV or Returns page | Yes |

Legacy values `preparing`/`prepared` remain in DB constraint but were migrated to `prep_status`.

#### B. `orders.confirmation_status`

| Status | Meaning |
|--------|---------|
| `unconfirmed` | Awaiting confirmation (DB default) |
| `confirmed` | Customer confirmed |
| `no_answer` | No response |
| `postponed` | Callback scheduled |
| `cancelled` | Customer cancelled |

#### C. `orders.prep_status`

| Status | Meaning |
|--------|---------|
| `pending` | Not in prep |
| `preparing` | On prep list, being prepared |
| `prepared` | Ready to ship |

#### D. Carrier status codes (Turbo/Accurate — 20+ codes)

Mapped via `carrier_status_mappings` with categories: `none`, `delivered`, `returned`, `in_progress`.

Examples: PRP, PRPD, STD, DEX, HTR, DTR, DTRC, RTS, RTSC, RTRN, RCV, UPKBD, etc.

---

### 1.3 Status Audit Findings

| Issue | Severity | Detail |
|-------|----------|--------|
| **Duplicate naming** | Medium | `pending`, `cancelled`, `delivered`, `confirmed` used across different fields with different meanings |
| **Orphan status `processing`** | Low | In schema and UI labels; no code path sets it |
| **Dead confirmation value `pending`** | **Critical** | `process-confirmation-reminders` filters `confirmation_status = 'pending'` but DB default is `unconfirmed` — **reminders never match** |
| **WhatsApp cancel desync** | High | Auto-cancel sets `confirmation_status=cancelled` but not always `orders.status=cancelled` |
| **No auto-delivered** | High | Carrier DTR* codes update `carrier_status` only; merchants must manually mark delivered |
| **Internal settlement bypass** | High | Internal tab settles `pending` orders directly to `settled` without shipping |
| **Limited status edit UI** | Medium | `OrderDetailsDialog` offers only 4 statuses; missing settled, unpacked, returned |
| **P&L excludes settled** | High | RPC counts `delivered` only; UI counts `delivered + settled` |

---

### 1.4 Recommended Status Structure

Align merchant, carrier, and financial views with a **unified lifecycle** plus orthogonal sub-states:

#### Primary: `orders.fulfillment_status` (proposed rename/refactor)

| Stage | Proposed Status | Maps From Current | Owner |
|-------|-----------------|-------------------|-------|
| 1 | **Pending** | `pending` + unconfirmed | Merchant |
| 2 | **Confirmed** | confirmation=confirmed, status still pending | Merchant |
| 3 | **Preparing** | prep_status=preparing | Warehouse |
| 4 | **Prepared** | prep_status=prepared | Warehouse |
| 5 | **Assigned To Shipping** | Just before ship-orders | Merchant |
| 6 | **Received By Shipping Company** | status=shipped, carrier=PRP/PRPD | Carrier |
| 7 | **In Transit** | carrier STD/DEX/HTR | Carrier |
| 8 | **Out For Delivery** | carrier OTR or equivalent | Carrier |
| 9 | **Delivered** | carrier DTR* OR manual delivered | Carrier/Merchant |
| 10 | **Delivery Failed** | carrier HTR/PKH (hold/retry) | Carrier |
| 11 | **Returned** | returned_received / RTS/RTRN | Carrier |
| 12 | **Unpacked** | unpacked (inventory restored) | Warehouse |
| 13 | **Settled** | settled (cash received) | Finance |
| 14 | **Cancelled** | cancelled | Any |

#### Missing stages today

| Missing Stage | Business Need |
|---------------|---------------|
| **Assigned To Shipping** | Batch handoff audit before carrier API call |
| **Received By Shipping Company** | Distinct from in-transit; confirms carrier accepted parcel |
| **Out For Delivery** | Last-mile visibility for customer service |
| **Delivery Failed** | Retry scheduling, SLA tracking |
| **Partial Delivery** | Multi-item orders (not supported) |
| **On Hold / Exception** | Address issues, COD disputes |

Keep `confirmation_status` and `prep_status` as **sub-states** until Phase 2 consolidation.

---

### 1.5 Status Metrics — Production Queries

Run against production Supabase to populate management reports:

```sql
-- Total orders per status
SELECT status, COUNT(*) AS order_count, SUM(price) AS total_value
FROM orders
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY order_count DESC;

-- Confirmation status distribution (pending tab workload)
SELECT confirmation_status, COUNT(*) AS cnt
FROM orders
WHERE status = 'pending' AND deleted_at IS NULL
GROUP BY confirmation_status;

-- Carrier status distribution (in-flight)
SELECT carrier_status, COUNT(*) AS cnt
FROM orders
WHERE status = 'shipped' AND deleted_at IS NULL
GROUP BY carrier_status
ORDER BY cnt DESC;

-- Average time in status (requires status_history table — NOT YET IMPLEMENTED)
-- Interim proxy: time from created_at to updated_at for terminal statuses
SELECT status,
       COUNT(*) AS cnt,
       ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600), 1) AS avg_hours
FROM orders
WHERE deleted_at IS NULL AND status IN ('delivered', 'settled', 'cancelled', 'returned_received')
GROUP BY status;

-- Orders stuck in status (> SLA threshold)
SELECT id, order_code, status, confirmation_status, carrier_status,
       created_at, updated_at,
       EXTRACT(DAY FROM NOW() - updated_at) AS days_stuck
FROM orders
WHERE deleted_at IS NULL
  AND (
    (status = 'pending' AND updated_at < NOW() - INTERVAL '3 days')
    OR (status = 'shipped' AND updated_at < NOW() - INTERVAL '7 days')
    OR (status = 'delivered' AND settlement_received = false AND updated_at < NOW() - INTERVAL '14 days')
  )
ORDER BY days_stuck DESC;

-- Unused statuses (should return processing=0)
SELECT status, COUNT(*) FROM orders GROUP BY status;
```

**Recommendation:** Add `order_status_history` table with `(order_id, from_status, to_status, changed_at, changed_by, source)` to enable accurate dwell-time and bottleneck analysis.

---

### 1.6 Workflow Reviews

#### Customer workflow
- Places order on landing page → `pending`
- Receives WhatsApp confirmation (if enabled)
- Replies confirm/cancel → updates `confirmation_status` (cancel may not sync to order status)
- **Gap:** No customer-facing order tracking portal

#### Merchant workflow
- Reviews pending orders → Confirmation Center
- Confirms prep → Prep Lists → Prep Orders
- Ships batch → `ship-orders`
- Manually marks delivered (carrier DTR ignored)
- Receives settlement → marks financially complete
- **Bottleneck:** Manual delivered step; no SLA alerts for stuck shipped orders

#### Shipping company workflow
- Receives via Turbo GraphQL API
- Sends status webhooks / polled via sync
- Settlement batches (CUSTM payments) synced separately
- **Gap:** Returns sync uses same CUSTM type as settlements (likely incorrect)

---

## 2. Shipping Dashboard Improvements

### 2.1 Current State

| Screen | What It Shows | Charts |
|--------|---------------|--------|
| Orders | Status tab counts, carrier delivery rate cards | Progress bars only |
| Confirmation Center | Queue counts, confirmation rate | None |
| Financial Accounts | In-delivery capital projection | **Recharts imported but not rendered** |
| Dashboard | Visits, checkouts, UTM sources | 1 LineChart (7-day) |

**No dashboards exist for:** orders by city, by shipping company, daily/weekly/monthly shipping volume, average delivery time, return rate trends.

### 2.2 Proposed Shipping Operations Dashboard

#### Panel A — Order Pipeline (real-time)

| KPI | Definition | Chart Type |
|-----|------------|------------|
| Orders by status | Count + value per `orders.status` | Stacked bar |
| Confirmation funnel | unconfirmed → confirmed → cancelled | Funnel |
| Prep backlog | prep_status counts | Donut |
| Shipped in transit | status=shipped by carrier category | Horizontal bar |

#### Panel B — Geographic

| KPI | Definition | Chart Type |
|-----|------------|------------|
| Orders by city | Group `matched_zone_name` or `city` | Map + bar (top 10) |
| Delivery success by city | delivered ÷ (delivered + returned) per city | Heat table |
| Avg delivery days by city | delivered_at − shipped_at | Bar |
| COD volume by city | Sum price where COD | Table |

#### Panel C — Carrier Performance

| KPI | Definition | Chart Type |
|-----|------------|------------|
| Orders by carrier status code | Group `carrier_status` / mapped code | Treemap |
| Delivery success rate | Category `delivered` ÷ all carrier-updated | Gauge (target 95%) |
| Return rate | Category `returned` ÷ shipped | Gauge (target <5%) |
| Failed delivery rate | HTR/PKH codes ÷ shipped | Trend line |
| Avg transit time | First shipped → DTR* timestamp | Line (weekly) |

#### Panel D — Time Series

| KPI | Chart |
|-----|-------|
| Daily orders | Line (orders created) |
| Weekly orders | Bar (WoW comparison) |
| Monthly orders | Bar + YoY overlay |
| Daily shipments to carrier | Line (ship-orders volume) |
| Daily deliveries | Line (DTR* or manual delivered) |

#### Panel E — Exceptions & SLA

| KPI | Alert Threshold |
|-----|-----------------|
| Stuck in pending > 3 days | Red badge |
| Stuck in shipped > 7 days | Red badge |
| Delivered unsettled > 14 days | Amber badge |
| Confirmation no_answer > 2 attempts | Queue priority |

### 2.3 Recommended Management KPIs

| KPI | Formula | Target |
|-----|---------|--------|
| **Order Confirmation Rate** | confirmed ÷ (confirmed + cancelled + no_answer) | > 70% |
| **Ship-to-Delivery Rate** | delivered ÷ shipped | > 90% |
| **On-Time Delivery** | delivered within SLA ÷ delivered | > 85% |
| **Return Rate** | returned ÷ delivered | < 8% |
| **Settlement Cycle Time** | avg(settled_at − delivered_at) | < 7 days |
| **COD Collection Rate** | settled_value ÷ delivered_value | > 95% |
| **First-Attempt Delivery** | DTR on first try ÷ attempts | > 80% |

---

## 3. Financial System Audit

### 3.1 Architecture Overview

Three **separate money systems**:

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│ Subscription Wallet │  │   Merchant Safes    │  │    Ad Wallets       │
│ (SaaS billing)      │  │   (COD/settlements) │  │   (FB ad spend)     │
│ wallets.balance     │  │ safes.balance       │  │ ad_wallets.balance  │
│ order_fee per order │  │ safe_movements      │  │ topups from safes   │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

**No commission engine exists.** Platform revenue is subscription `order_fee` only.

### 3.2 Revenue Calculations

| Calculation | Source | Issue |
|-------------|--------|-------|
| Order revenue | `orders.price` (header) | May not match sum of `order_items` |
| Delivered revenue (UI) | status IN (`delivered`, `settled`) | Correct for merchant view |
| Delivered revenue (RPC) | status = `delivered` only | **Excludes settled orders** |
| COGS (UI) | Live `products.purchase_price` | Historical drift if prices changed |
| COGS (RPC) | `purchase_price_snapshot` on items | Correct at time of sale |
| Orphan revenue | Unlinked settlement shipments | Counted in sales KPI, excluded from profit |
| Shipping fees | `settlements.due_fees`, per-shipment fees | **Stored but not in P&L** |

### 3.3 Settlement Flow

```
Carrier payment batch → settlements table (sync-settlements)
    → Link shipments to orders (sync-settlement-shipments)
    → User confirms receive (receive-settlement)
        → orders.settlement_received = true, status = settled
        → safe_movements: deposit +payment_amount
        → safes.balance updated via trigger
```

**Issues:**
- Deposit uses full `payment_amount`; `due_fees` not reconciled against deposit
- Internal settlement tab bypasses carrier flow (pending → settled directly)
- Atomic RPC `settle_orders_into_safe` exists but UI doesn't use it

### 3.4 Returns Financial Impact

| Event | Financial Effect |
|-------|------------------|
| Order → `returned_received` (was settled) | Trigger: `return_refund` movement = `-orders.price` |
| Order → `returned_received` (never settled) | **No safe reversal** (correct if never paid) |
| Order → `returned_received` (manual delivered, never settled) | **No financial action** — gap if COD was collected offline |

### 3.5 Critical Financial Bugs

| # | Bug | Risk | File |
|---|-----|------|------|
| 1 | **Ad wallet topup double-deducts safe** | Direct cash loss | `src/pages/AdWallets.tsx:115` — manual balance update + trigger |
| 2 | **P&L RPC vs UI mismatch on settled** | Wrong official reports | `profit_loss_report` RPC vs `FinancialAccounts.tsx` |
| 3 | **COGS source inconsistency** | Margin drift | RPC snapshot vs UI live price |
| 4 | **Internal settlement on pending orders** | Fraud / premature recognition | `Settlements.tsx` internal tab |
| 5 | **No negative balance guard on safes** | Overdraft without approval | Expenses/Purchases pages |
| 6 | **Returns sync may duplicate settlements** | Data integrity | `sync-returns` uses CUSTM type |
| 7 | **Period close missing owner_id** | Close may fail | `ProfitLossReport.tsx` |

### 3.6 Missing Financial Controls

| Control | Status | Recommendation |
|---------|--------|----------------|
| Dual approval for settlements > X | Missing | Add approval workflow |
| Safe balance cannot go negative | Missing | Block or require override |
| Settlement amount vs order sum reconciliation | Missing | Validate deposit = sum(linked orders) |
| Commission calculation | Missing | Add if platform takes % |
| Merchant withdrawal/payout | Missing | Add payout request + approval |
| Accounting period lock on all tables | Partial | Extend to expenses, purchases |
| Audit trail on manual status changes | Partial | Log all status overrides |
| Idempotency on settlement receive | Present | Good — unique movement refs |

### 3.7 Fraud Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Internal settlement of unshipped orders | Medium | High | Require status ≥ delivered |
| Manual delivered without carrier proof | High | Medium | Require carrier DTR or photo proof |
| Duplicate settlement receive | Low | High | Existing unique refs — maintain |
| Ad wallet double-charge | **Confirmed bug** | High | Remove manual balance update |
| Return without refund when settled | Low | Medium | Trigger exists — verify edge cases |
| Negative safe balance spending | Medium | Medium | Add balance check |
| Orphan revenue in KPIs inflates sales | Medium | Low | Separate orphan line in reports |

---

## 4. Financial Reporting Recommendations

### 4.1 Existing Reports

| Report | Location | Completeness |
|--------|----------|--------------|
| Profit & Loss | `/dashboard/profit-loss` | Partial — no ad spend, no shipping fees |
| Financial Accounts | `/dashboard/financial` | Rich KPIs, no charts rendered |
| Settlements | `/dashboard/settlements` | Operational list |
| Facebook Performance | `/dashboard/facebook-performance` | Ad ROI only |
| Cash Flow | DB RPC only | **No UI** |

### 4.2 Recommended Report Suite

#### A. Profit & Loss Statement (enhanced)

| Line Item | Source |
|-----------|--------|
| Gross Sales | SUM(orders.price) WHERE status IN (delivered, settled) |
| Returns & Refunds | SUM(return_refund movements) |
| **Net Sales** | Gross − Returns |
| COGS | SUM(qty × purchase_price_snapshot) |
| **Gross Profit** | Net Sales − COGS |
| Shipping Fees Paid | SUM(settlements.due_fees) |
| Operating Expenses | SUM(expenses) + SUM(ad_spends) |
| **Net Profit** | Gross Profit − Shipping Fees − Expenses |

#### B. Revenue Report
- By product, city, channel (UTM), date range
- Compare periods (MoM, YoY)
- Export CSV/PDF

#### C. Expense Report
- By expense type, safe, date
- Budget vs actual (future)

#### D. Shipping Revenue Report
- COD collected vs shipping fees deducted
- Net remittance per settlement batch
- Fee ratio: due_fees ÷ payment_amount

#### E. Merchant Revenue Report (multi-store admin)
- Per-store revenue, orders, margin
- Ranking and growth

#### F. Commission Revenue Report (future)
- Platform fee per order (`order_fee`)
- % commission on GMV if introduced

#### G. Cash Flow Statement
- Wire existing `cash_flow_report` RPC to UI
- Group `safe_movements` by type over time
- Opening balance + movements = closing balance

#### H. Outstanding Balances
- Delivered but unsettled orders (COD in transit)
- Pending carrier settlements (received=false)
- Merchant safe balances

#### I. Settlement Reports
- Aging: settlements pending > 7/14/30 days
- Reconciliation: payment_amount vs sum(shipment paid_amount)
- Reversal audit log

---

## 5. Merchant Accounting Review

### 5.1 Current Wallet / Safe Model

The system does **not** implement classic merchant wallet buckets. Actual model:

| Concept | Implementation |
|---------|----------------|
| **Available balance** | `safes.balance` = SUM(safe_movements) |
| **Pending balance** | Delivered orders where `settlement_received = false` (UI KPI only, not a ledger account) |
| **Withdrawn balance** | **Not implemented** — no payout workflow |
| **Frozen balance** | **Not implemented** |
| **Returned deductions** | `return_refund` movement when settled order returns |

Subscription wallet (`wallets.balance`) is separate SaaS billing — not merchant earnings.

### 5.2 Recommended Merchant Ledger

Introduce explicit balance buckets per merchant/store:

```
merchant_accounts
├── available_balance    (settled, in safe, withdrawable)
├── pending_balance      (delivered, awaiting carrier settlement)
├── in_transit_balance   (shipped, not yet delivered)
├── frozen_balance       (disputes, chargebacks)
├── total_withdrawn      (lifetime payouts)
└── reserved_balance     (pending withdrawal requests)
```

**Movement rules:**

| Event | Debit/Credit |
|-------|--------------|
| Order delivered | +pending_balance |
| Settlement received | −pending, +available |
| Return (was settled) | −available (return_refund) |
| Withdrawal approved | −available, +total_withdrawn |
| Dispute opened | −available, +frozen |

### 5.3 Improvements

1. **Payout request workflow** — merchant requests withdrawal → admin approves → bank transfer logged
2. **Automatic pending → available** on settlement confirm (currently implicit via safe deposit)
3. **Return deduction rules** — configurable: deduct shipping fee on return?
4. **Multi-safe allocation** — split revenue across safes (cash vs bank)
5. **Merchant statement** — monthly PDF: opening, movements, closing

---

## 6. Executive Dashboard Recommendations

### 6.1 CEO Dashboard — Proposed Layout

#### Row 1: Today's Pulse

| Widget | Metric | Source |
|--------|--------|--------|
| Today's Sales | SUM(price) orders created today | orders |
| Today's Orders | COUNT today | orders |
| Today's Deliveries | COUNT status→delivered today | order_status_history (future) |
| Net Profit Today | Revenue − COGS − expenses (today) | computed |

#### Row 2: Monthly Performance

| Widget | Metric |
|--------|--------|
| Monthly Sales | MTD revenue vs last month |
| Monthly Orders | MTD count vs target |
| Net Profit MTD | P&L net profit |
| Gross Margin % | (Revenue − COGS) ÷ Revenue |

#### Row 3: Operations Health

| Widget | Metric | Target |
|--------|--------|--------|
| Delivery Success Rate | delivered ÷ shipped | > 90% |
| Return Rate | returned ÷ delivered | < 8% |
| Confirmation Rate | confirmed ÷ processed | > 70% |
| Avg Delivery Time | days shipped → delivered | < 5 |

#### Row 4: Scale

| Widget | Metric |
|--------|--------|
| Total Merchants | COUNT active stores |
| Total Customers | COUNT distinct phone |
| Total Orders (lifetime) | COUNT orders |
| Active Orders | pending + shipped |

#### Row 5: Rankings

| Widget | Top 5 |
|--------|-------|
| Top Cities | By revenue |
| Top Products | By revenue + margin |
| Top Merchants | By revenue (admin) |
| Top Traffic Sources | By conversion |

#### Row 6: Alerts

- Orders stuck > SLA
- Settlements pending > 14 days
- Safes with negative balance
- Return rate spike (> 2× average)
- Confirmation queue > 100

### 6.2 Implementation Path

1. **Phase 1:** Single `/dashboard/executive` page aggregating existing RPCs + new SQL views
2. **Phase 2:** Render existing `monthlyData` / `expensesByType` in FinancialAccounts (charts already coded)
3. **Phase 3:** Real-time refresh via Supabase realtime on orders table
4. **Phase 4:** Platform admin view across all stores

---

## 7. Automation Opportunities

### 7.1 Ranked by Impact × Feasibility

| Rank | Automation | Impact | Effort | Priority |
|------|------------|--------|--------|----------|
| 1 | **Auto-set delivered on carrier DTR*** | High | Low | P0 |
| 2 | **Fix confirmation reminder cron** | High | Low | P0 |
| 3 | **Automatic settlement reconciliation** | High | Medium | P1 |
| 4 | **SLA alerts (stuck orders)** | High | Medium | P1 |
| 5 | **Auto commission calculation** | High | Medium | P1 |
| 6 | **Automatic return handling** | Medium | Medium | P2 |
| 7 | **Automatic merchant payouts** | High | High | P2 |
| 8 | **Financial anomaly alerts** | Medium | Medium | P2 |
| 9 | **Fraud detection rules** | Medium | High | P3 |
| 10 | **Scheduled report emails** | Low | Low | P3 |

### 7.2 Detail

#### Automatic settlement calculations
- On `receive-settlement`: validate `payment_amount = SUM(linked shipment paid_amount) − due_fees`
- Flag discrepancies > 1% for review
- Auto-link orphan shipments by reference number

#### Automatic commission calculations
- Add `platform_commission_rate` to store settings
- On settlement: `commission = order.price × rate`
- Credit platform safe; net to merchant safe

#### Automatic return handling
- On carrier RTS/RTRN: auto-create return batch entry
- Auto-restore stock (already partial)
- Auto-refund if settled (trigger exists — extend to partial returns)

#### Automatic merchant payouts
- Weekly job: if `available_balance > threshold`, create payout request
- Admin approval queue
- Bank transfer integration (manual mark-paid initially)

#### Financial alerts
- Safe balance < 0
- Settlement pending > 14 days
- Return rate > 10% (7-day rolling)
- Revenue drop > 30% WoW

#### Fraud detection alerts
- Same phone, > 5 orders/day
- Internal settlement on order < 24h old
- Manual status change delivered without carrier update
- Settlement amount mismatch

---

## 8. Implementation Roadmap

### Phase 0 — Critical Fixes (Week 1)

- [ ] Fix `process-confirmation-reminders`: change `pending` → `unconfirmed`
- [ ] Fix `AdWallets.tsx`: remove manual `safes.update({ balance })` — rely on trigger only
- [ ] Align `profit_loss_report` RPC: include `settled` status
- [ ] Sync WhatsApp cancel to also set `orders.status = cancelled`

### Phase 1 — Visibility (Weeks 2–4)

- [ ] Add `order_status_history` table + log all transitions
- [ ] Render financial charts in `FinancialAccounts.tsx` (code exists)
- [ ] Build Shipping KPI dashboard (status, city, carrier)
- [ ] Wire `cash_flow_report` RPC to new Cash Flow page
- [ ] Add stuck-order SLA alerts

### Phase 2 — Controls (Weeks 5–8)

- [ ] Unified status transition validation (state machine)
- [ ] Auto-delivered on carrier DTR* (configurable per store)
- [ ] Settlement reconciliation checks
- [ ] Block internal settlement unless status ≥ delivered
- [ ] Safe negative balance guard

### Phase 3 — Scale (Weeks 9–12)

- [ ] Merchant ledger with pending/available/frozen buckets
- [ ] Payout request workflow
- [ ] Commission engine
- [ ] Executive dashboard
- [ ] Scheduled PDF/CSV reports

### Phase 4 — Intelligence (Ongoing)

- [ ] Fraud detection rules engine
- [ ] Predictive delivery ETA
- [ ] Demand forecasting by city/product
- [ ] Multi-carrier support and comparison

---

## 9. Appendix

### A. Key Source Files

| Area | Path |
|------|------|
| Order statuses UI | `src/pages/Orders.tsx` |
| Confirmation | `src/pages/ConfirmationCenter.tsx` |
| Ship to carrier | `supabase/functions/ship-orders/index.ts` |
| Carrier webhook | `supabase/functions/carrier-webhook/index.ts` |
| Settlement receive | `supabase/functions/receive-settlement/index.ts` |
| P&L RPC | `supabase/migrations/20260601020137_*.sql` |
| Financial dashboard | `src/pages/FinancialAccounts.tsx` |
| Safes | `src/pages/Safes.tsx` |
| Ad wallets | `src/pages/AdWallets.tsx` |
| Return refund trigger | `supabase/migrations/20260601020137_*.sql` |

### B. Status Transition Matrix (Current — Simplified)

| From → To | Allowed? | How |
|-----------|----------|-----|
| pending → shipped | Yes | ship-orders |
| pending → cancelled | Yes | confirmation cancel |
| pending → settled | Yes | internal settlement (should be restricted) |
| shipped → delivered | Manual only | UI |
| shipped → unpacked | Yes | carrier auto |
| shipped → returned_received | Yes | carrier auto |
| delivered → settled | Yes | receive-settlement |
| settled → delivered | Yes | settlement reversal |
| any → cancelled | Partial | not from settled |

### C. Glossary

| Term | Meaning |
|------|---------|
| COD | Cash on delivery — collected by carrier, remitted via settlement |
| Settlement | Carrier payment batch remitting collected COD minus fees |
| Safe | Merchant cash account (physical cash or bank) |
| Prep | Warehouse order preparation before shipping |
| Carrier status | Shipping company's internal tracking code |
| Orphan shipment | Settlement line not linked to a local order |

---

*End of report. Recommendations ranked by business impact and implementation priority. Phase 0 items should be addressed before any new feature development.*
