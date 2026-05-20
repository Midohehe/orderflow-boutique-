import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/hooks/useStoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Facebook, Link2, Unlink, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Connection {
  id: string;
  fb_user_name: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  token_expires_at: string | null;
  connected_at: string;
}

const FacebookAds = () => {
  const { activeStoreId, activeStore } = useStoreContext() as any;
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [conn, setConn] = useState<Connection | null>(null);

  useEffect(() => {
    const fb = params.get("fb");
    if (fb === "success") toast({ title: "تم الربط بنجاح", description: "تم ربط حساب فيسبوك بالمتجر" });
    else if (fb === "error") toast({ title: "فشل الربط", description: params.get("msg") || "", variant: "destructive" });
    if (fb) {
      params.delete("fb"); params.delete("msg"); setParams(params, { replace: true });
    }
  }, []);

  const load = async () => {
    if (!activeStoreId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("store_facebook_connections" as any)
      .select("id, fb_user_name, ad_account_id, ad_account_name, token_expires_at, connected_at")
      .eq("store_id", activeStoreId)
      .maybeSingle();
    setConn((data as any) || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeStoreId]);

  const connect = async () => {
    if (!activeStoreId) { toast({ title: "اختر متجراً أولاً", variant: "destructive" }); return; }
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("facebook-oauth-start", {
        body: { store_id: activeStoreId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const authUrl = (data as any)?.auth_url;
      if (!authUrl) throw new Error("لم يتم الحصول على رابط فيسبوك");
      window.location.href = authUrl;
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!conn) return;
    if (!confirm("هل تريد فصل حساب فيسبوك عن هذا المتجر؟")) return;
    const { error } = await supabase.from("store_facebook_connections" as any).delete().eq("id", conn.id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم الفصل" }); setConn(null); }
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#1877F2] text-white flex items-center justify-center shadow-md">
          <Facebook className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">إعلانات فيسبوك</h1>
          <p className="text-sm text-muted-foreground">اربط حساب إعلانات فيسبوك بالمتجر الحالي{activeStore?.name ? `: ${activeStore.name}` : ""}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>حالة الربط</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : conn ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="font-semibold">متصل</span>
                <Badge variant="secondary">{conn.fb_user_name || "حساب فيسبوك"}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">حساب الإعلانات</div>
                  <div className="font-medium">{conn.ad_account_name || conn.ad_account_id || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">تاريخ الانتهاء</div>
                  <div className="font-medium">{conn.token_expires_at ? new Date(conn.token_expires_at).toLocaleDateString("ar-LY") : "—"}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={connect} disabled={connecting}>
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  <span className="mr-2">إعادة الربط</span>
                </Button>
                <Button variant="destructive" onClick={disconnect}>
                  <Unlink className="w-4 h-4" />
                  <span className="mr-2">فصل الحساب</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                اربط حساب فيسبوك الخاص بك لتتبع نتائج الحملات الإعلانية (الإنفاق، النقرات، الظهور، التحويلات) داخل لوحة التحكم.
              </p>
              <Button onClick={connect} disabled={connecting} className="bg-[#1877F2] hover:bg-[#166fe5] text-white gap-2">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Facebook className="w-4 h-4" />}
                ربط حساب فيسبوك
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FacebookAds;