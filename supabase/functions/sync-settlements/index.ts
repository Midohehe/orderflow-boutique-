// Syncs customer payment settlements (سداد مستحقات العملاء) from the shipping
// company (Turbo Express / Accurate). Authenticates with the same email/password
// stored in shipping_settings, queries listPayments(typeCode: CUSTM), then for
// each payment loads its shipment entries and links them back to local orders.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FINANCIAL_ENDPOINT = "https://turboex.ly:8443/graphql";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ownerId = userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settingsRows } = await admin
      .from("shipping_settings")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("enabled", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    const settings = settingsRows?.[0];
    if (!settings || !settings.email || !settings.password) {
      return new Response(JSON.stringify({ error: "إعدادات شركة الشحن غير مكتملة أو غير مفعّلة" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Login on the financial endpoint
    const loginRes = await fetch(FINANCIAL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation Login($input: LoginInput!) { login(input: $input) { token } }`,
        variables: { input: { username: settings.email, password: settings.password, rememberMe: true } },
      }),
    });
    const loginJson = await loginRes.json().catch(() => ({}));
    const token: string | undefined = loginJson?.data?.login?.token;
    if (!token) {
      return new Response(JSON.stringify({
        error: "فشل تسجيل الدخول لشركة الشحن", details: loginJson,
      }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const gql = async (query: string, variables: Record<string, unknown> = {}) => {
      const r = await fetch(FINANCIAL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query, variables }),
      });
      return await r.json().catch(() => ({}));
    };

    // Page through listPayments(typeCode: CUSTM)
    const LIST_QUERY = `query ($input: ListPaymentFilterInput!, $first: Int!, $page: Int) {
      listPayments(input: $input, first: $first, page: $page) {
        paginatorInfo { hasMorePages currentPage }
        data {
          id code date approved notes
          customer { name }
          safe { name }
          transactionType { name }
          sumEntries { deliveredAmount piecesCount collectedFees dueFees weight paymentAmount }
          entriesShipment: entries(typeCode: SHIPMENT) { paginatorInfo { total } }
        }
      }
    }`;

    const allPayments: any[] = [];
    let page = 1;
    while (true) {
      const res = await gql(LIST_QUERY, { input: { typeCode: "CUSTM" }, first: 100, page });
      const list = res?.data?.listPayments;
      if (!list) break;
      allPayments.push(...(list.data || []));
      if (!list.paginatorInfo?.hasMorePages) break;
      page += 1;
      if (page > 50) break; // safety
    }

    // Upsert settlements (exclude RTRN return lists which have their own table)
    const nonRtrnPayments = allPayments.filter((p) =>
      typeof p?.code === "string" && !p.code.toUpperCase().startsWith("RTRN")
    );
    const settlementRows = nonRtrnPayments.map((p) => ({
      owner_id: ownerId,
      external_id: p.id,
      code: p.code,
      settlement_date: p.date ? new Date(p.date.replace(" ", "T") + "Z").toISOString() : null,
      payment_amount: Number(p.sumEntries?.paymentAmount ?? 0),
      due_fees: Number(p.sumEntries?.dueFees ?? 0),
      delivered_amount: Number(p.sumEntries?.deliveredAmount ?? 0),
      pieces_count: Number(p.sumEntries?.piecesCount ?? 0),
      shipment_count: Number(p.entriesShipment?.paginatorInfo?.total ?? 0),
      customer_name: p.customer?.name ?? null,
      safe_name: p.safe?.name ?? null,
      transaction_type: p.transactionType?.name ?? null,
      notes: p.notes ?? null,
      approved: !!p.approved,
      raw: p,
    }));

    if (settlementRows.length > 0) {
      const { error: upErr } = await admin
        .from("settlements")
        .upsert(settlementRows, { onConflict: "owner_id,external_id" });
      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      ok: true, count: settlementRows.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});