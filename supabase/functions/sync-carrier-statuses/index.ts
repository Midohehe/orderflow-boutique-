// Resumable shipment synchronization with bounded batches and persistent progress.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { carrierCodeToOrderStatus } from "../_shared/carrier-order-status.ts";
import { resolveCarrierShipment } from "../_shared/carrier-shipment-lookup.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATUS_LABELS: Record<string, string> = {
  PRP: "جارى التجهيز",
  PRPD: "تم التجهيز",
  STD: "قيد الارسال للمندوب",
  DEX: "متابعة",
  HTR: "انتظار لإعادة التوصيل",
  PKH: "انتظار لإعادة الالتقاط",
  DTR: "تم التسليم",
  DTRC: "تم التسليم والتحصيل",
  DTRCP: "تم التسليم والسداد للعميل",
  DTRUC: "تم التسليم دون تحصيل",
  RTS: "راجع",
  RTSD: "راجع لدى المندوب",
  RTSC: "راجع لدى الشركة",
  OTR: "قيد الإرجاع",
  RTRN: "تم الإرجاع للراسل",
  RCV: "ارتجاع للمخزن",
  UPKBL: "جاهز للتفريغ",
  UPKBD: "تم التفريغ",
  UKDB: "تم التفريغ",
  BMR: "مناولة بين الفروع - وارد",
  BMT: "مناولة بين الفروع - صادر",
};

function buildComposite(statusCode: string | null, deliveryTypeCode: any, returnTypeCode: any): string | null {
  if (!statusCode) return null;
  const base = String(statusCode).trim();
  if (!base) return null;
  if (base.toUpperCase() === "DTR") return "DTR";
  if (base.toUpperCase() === "RTS") {
    const suffix = deliveryTypeCode ?? returnTypeCode;
    if (suffix != null && String(suffix).trim() !== "") return base + String(suffix).trim();
  }
  return base;
}

const JOB_COLUMNS = "id,store_id,total,processed,updated,failed,skipped,state,codes,errors,last_error,started_at,updated_at,locked_until";
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const boundedFetch: typeof fetch = (input, init={}) => fetch(input, {...init,signal: init.signal ? AbortSignal.any([init.signal,AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000)});
// Reuse short-lived carrier sessions across batches on the same worker.
// Tokens remain server-side and are never included in job progress responses.
const carrierSessions = new Map<string, { token: string; expiresAt: number }>();

Deno.serve(async (req) => {
  if(req.method === "OPTIONS") return new Response(null,{headers:corsHeaders});
  if(req.method !== "POST") return json({error:"Method not allowed"},405);
  let admin: ReturnType<typeof createClient> | undefined;
  let storeId: string | undefined, jobId: string | undefined, leaseId: string | undefined;
  try {
    const bearer=req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if(!bearer) return json({error:"Unauthorized"},401);
    admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{global:{fetch:boundedFetch}});
    const {data:auth,error:authError}=await admin.auth.getUser(bearer);
    if(authError || !auth.user) return json({error:"Unauthorized"},401);
    const scoped=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{global:{fetch:boundedFetch,headers:{Authorization:`Bearer ${bearer}`}}});
    const body=await req.json().catch(()=>null);
    storeId=body?.store_id;
    if(!storeId || !/^[0-9a-f-]{36}$/i.test(storeId)) return json({error:"store_id مطلوب"},400);
    const {data:store,error:storeError}=await admin.from("stores").select("id,owner_id").eq("id",storeId).maybeSingle();
    if(storeError) throw storeError;
    if(!store || store.owner_id!==auth.user.id) return json({error:"المزامنة متاحة لصاحب المتجر فقط"},403);
    const action=body?.action;
    if(!["status","start","batch"].includes(action)) return json({error:"حدّث الصفحة لتشغيل المزامنة الجديدة مع عرض التقدّم"},409);
    if(action==="status") {
      const {data,error}=await admin.from("carrier_sync_jobs").select(JOB_COLUMNS).eq("store_id",storeId).maybeSingle();
      if(error) throw error;
      return json({ok:true,job:data});
    }
    if(action==="start") {
      const {data,error}=await admin.rpc("start_carrier_sync",{_store_id:storeId});
      if(error) throw error;
      return json({ok:true,job:data});
    }
    jobId=body?.job_id;
    if(!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return json({error:"معرّف المزامنة مطلوب"},400);
    const {data:claim,error:claimError}=await admin.rpc("claim_carrier_sync_batch",{_store_id:storeId,_job_id:jobId});
    if(claimError) throw claimError;
    if(claim.busy || claim.job.state==="completed") return json({ok:true,busy:claim.busy,job:claim.job});
    leaseId=claim.lease_id;
    const ids: string[]=claim.order_ids;
    const [{data:settingsRows,error:settingsError},{data:app,error:appError},{data:orders,error:ordersError},{data:mappings,error:mappingsError}]=await Promise.all([
      admin.from("shipping_settings").select("email,password,endpoint,updated_at").eq("owner_id",store.owner_id).eq("enabled",true).order("updated_at",{ascending:false}).limit(1),
      admin.from("app_settings").select("shipping_endpoint").limit(1).maybeSingle(),
      admin.from("orders").select("id,shipping_id,shipping_reference,status,is_deleted").eq("store_id",storeId).eq("status","shipped").eq("is_deleted",false).in("id",ids),
      scoped.rpc("list_carrier_mappings_for_store",{_store_id:storeId,_owner_id:store.owner_id}),
    ]);
    if(ordersError) throw ordersError;
    if(!orders?.some((order:{status:string;is_deleted:boolean;shipping_id:unknown})=>order.status==="shipped" && !order.is_deleted && order.shipping_id!=null)) {
      const {data:job,error}=await admin.rpc("finish_carrier_sync_batch",{_store_id:storeId,_job_id:jobId,_lease_id:leaseId,_updated:0,_failed:0,_skipped:ids.length,_codes:claim.job.codes||[],_errors:claim.job.errors||[]});
      if(error) throw error;
      return json({ok:true,job});
    }
    if(settingsError || appError || mappingsError) throw settingsError || appError || mappingsError;
    const settings=settingsRows?.[0];
    if(!settings?.email || !settings?.password) throw Error("إعدادات شركة الشحن غير مكتملة. صحّحها ثم اضغط استكمال.");
    const endpoint=app?.shipping_endpoint || settings.endpoint || "https://turboex.ly:8001/graphql";
    const sessionKey=JSON.stringify([storeId,endpoint,settings.email,settings.updated_at]);
    const cached=carrierSessions.get(sessionKey);
    let token=cached && cached.expiresAt>Date.now()?cached.token:null;
    if(!token) {
      const login=await boundedFetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:"mutation Login($input: LoginInput!) { login(input: $input) { token } }",variables:{input:{username:settings.email,password:settings.password,rememberMe:true}}})});
      const loginBody=await login.json().catch(()=>null);
      token=loginBody?.data?.login?.token;
      if(!login.ok || !token) throw Error("فشل تسجيل الدخول لشركة الشحن. راجع بيانات الربط ثم استكمل المزامنة.");
      if(carrierSessions.size>=100) carrierSessions.delete(carrierSessions.keys().next().value!);
      carrierSessions.set(sessionKey,{token,expiresAt:Date.now()+5*60_000});
    }
    const mappingMap=new Map<string,string>();
    if(!mappingsError) (mappings||[]).forEach((m: {status_code:string;custom_label:string})=>{if(m.custom_label) mappingMap.set(String(m.status_code).toUpperCase(),m.custom_label)});
    const codes=new Map<string,{code:string;count:number;label:string;mapped:boolean}>((claim.job.codes||[]).map((c: {code:string;count:number;label:string;mapped:boolean})=>[c.code,c]));
    const errors: string[]=[...(claim.job.errors||[])];
    let updated=0,failed=0,skipped=0;
    const shipmentFields=`id code refNumber notes status { code name } deliveryType { code name } returnType { code name } cancellationReason { id name } collectedFees deliveredAmount`;
    const lookupShipment=async(key:{id:number}|{code:string})=>{
      const byId='id' in key;
      const query=byId?`query ($id: Int!) { shipment(id: $id) { ${shipmentFields} } }`:`query ($code: String!) { shipment(code: $code) { ${shipmentFields} } }`;
      const response=await boundedFetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({query,variables:key})});
      if(!response.ok) {
        if(response.status===401 || response.status===403) carrierSessions.delete(sessionKey);
        throw Error(`تعذّر الاتصال بشركة الشحن (${response.status})`);
      }
      const result=await response.json();
      if(result.errors?.length) throw Error('رفضت شركة الشحن قراءة الحالة: '+String(result.errors[0]?.message || 'خطأ في الاستعلام').split(token!).join('[محجوب]').slice(0,250));
      return result?.data?.shipment || null;
    };
    const processOne=async(id:string)=>{
      const order=orders?.find((o:{id:string})=>o.id===id);
      try {
        if(!order || order.is_deleted || order.status!=="shipped" || order.shipping_id==null) { skipped++; return; }
        const shipment=await resolveCarrierShipment(order,lookupShipment);
        const resolvedShippingId=String(shipment.id);
        const code=buildComposite(shipment.status?.code??null,shipment.deliveryType?.code,shipment.returnType?.code);
        if(!code) throw Error("حالة الشحنة غير موجودة في رد شركة الشحن");
        const custom=mappingMap.get(code.toUpperCase());
        const label=custom || (STATUS_LABELS[code]?`${STATUS_LABELS[code]} (${code})`:code);
        const payload: Record<string,unknown>={carrier_status:label,carrier_status_updated_at:new Date().toISOString(),carrier_status_raw:shipment};
        if(String(order.shipping_id)!==resolvedShippingId) payload.shipping_id=resolvedShippingId;
        const reason=shipment.cancellationReason?.name??shipment.cancellationReason?.id;
        if(reason!=null && String(reason).trim()) payload.carrier_cancellation_reason_id=String(reason);
        if(shipment.notes!=null && String(shipment.notes).trim()) payload.carrier_notes=String(shipment.notes);
        const nextStatus=carrierCodeToOrderStatus(code);
        // Keep unpacked orders eligible for retry until their stock update succeeds.
        if(nextStatus && nextStatus!=="unpacked") payload.status=nextStatus;
        let save=admin!.from("orders").update(payload).eq("id",id).eq("store_id",storeId).eq("is_deleted",false).eq("status","shipped").eq("shipping_id",order.shipping_id);
        if(order.shipping_reference) save=save.eq("shipping_reference",order.shipping_reference);
        const {data:saved,error}=await save.select("id").maybeSingle();
        if(error) throw Error("تعذّر حفظ حالة الطلب: "+error.message);
        if(!saved) { skipped++; return; } // Status or shipment changed while the carrier request was in flight.
        if(["UPKBD","UKDB","UPKBL"].includes(code)) {
          const stock=await boundedFetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/apply-order-stock`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`},body:JSON.stringify({order_id:id,reason:"order_unpacked"})});
          const stockResult=await stock.json().catch(()=>null);
          if(!stock.ok || !stockResult?.ok || stockResult.errors?.length) throw Error("تمت قراءة حالة الشحنة لكن تعذّر تحديث المخزون؛ أعد المزامنة");
          const {data:unpacked,error:unpackError}=await admin!.from("orders").update({status:"unpacked"}).eq("id",id).eq("store_id",storeId).eq("is_deleted",false).eq("status","shipped").eq("shipping_id",payload.shipping_id ?? order.shipping_id).eq("carrier_status_updated_at",payload.carrier_status_updated_at).select("id").maybeSingle();
          if(unpackError) throw Error("تعذّر حفظ حالة التفريغ؛ أعد المزامنة");
          if(!unpacked) { skipped++; return; }
        }
        const stat=codes.get(code)||{code,count:0,label:STATUS_LABELS[code]||shipment.status?.name||code,mapped:!!custom};
        codes.set(code,{...stat,count:stat.count+1});
        updated++;
      } catch(error) {
        failed++;
        const e=error as Error;
        const message=e.name==="TimeoutError" || e.name==="AbortError"?"انتهت مهلة انتظار شركة الشحن":e.message;
        if(errors.length<10) errors.push(`${order?.shipping_reference || id.slice(0,8)}: ${message}`);
      }
    };
    // Five shipments per request; every network operation has a 10s deadline.
    for(let offset=0;offset<ids.length;offset+=5) await Promise.all(ids.slice(offset,offset+5).map(processOne));
    const {data:job,error:finishError}=await admin.rpc("finish_carrier_sync_batch",{_store_id:storeId,_job_id:jobId,_lease_id:leaseId,_updated:updated,_failed:failed,_skipped:skipped,_codes:[...codes.values()],_errors:errors});
    if(finishError) throw finishError;
    return json({ok:true,job});
  } catch(error) {
    const e=error as Error;
    const message=e.name==="TimeoutError" || e.name==="AbortError"?"انتهت مهلة الاتصال. التقدّم محفوظ؛ اضغط استكمال للمحاولة مجددًا.":e.message || "تعذّرت المزامنة؛ أعد المحاولة";
    if(admin && storeId && jobId && leaseId) {
      try { await admin.from("carrier_sync_jobs").update({lease_id:null,locked_until:null,last_error:message}).eq("store_id",storeId).eq("id",jobId).eq("lease_id",leaseId); } catch { /* The expiring lease allows a later resume. */ }
    }
    return json({error:message},502);
  }
});
