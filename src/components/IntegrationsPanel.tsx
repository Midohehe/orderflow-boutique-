import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Webhook, Copy, RefreshCw } from "lucide-react";

const IntegrationsPanel = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [webhookToken, setWebhookToken] = useState("");
  const [rotating, setRotating] = useState(false);
  const [easyOrdersKey, setEasyOrdersKey] = useState("");
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [syncOrderId, setSyncOrderId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [eoProductsCount, setEoProductsCount] = useState(0);

  const loadEoCount = async () => {
    const { count } = await supabase.from("easyorders_products").select("id", { count: "exact", head: true });
    setEoProductsCount(count || 0);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("webhook_token, easyorders_api_key")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setWebhookToken((data as any).webhook_token || "");
        setEasyOrdersKey((data as any).easyorders_api_key || "");
      }
      setLoading(false);
      loadEoCount();
    })();
  }, [user]);

  const syncProducts = async () => {
    setSyncingProducts(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-easyorders-products");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error + (((data as any).details) ? ": " + (data as any).details : ""));
      toast({ title: "تمت المزامنة", description: `تم جلب ${(data as any).count} منتج` });
      await loadEoCount();
    } catch (e: any) {
      toast({ title: "فشلت المزامنة", description: e.message, variant: "destructive" });
    } finally {
      setSyncingProducts(false);
    }
  };

  const syncOrder = async () => {
    const ids = Array.from(new Set(
      syncOrderId.split(/[\s,;\n]+/).map((s) => s.trim()).filter(Boolean)
    ));
    if (ids.length === 0) {
      toast({ title: "أدخل رقم طلب واحد على الأقل", variant: "destructive" });
      return;
    }
    setSyncing(true);
    let success = 0;
    const failures: { id: string; msg: string }[] = [];
    for (const id of ids) {
      try {
        const { data, error } = await supabase.functions.invoke("sync-easyorder", { body: { order_id: id } });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error + (((data as any).details) ? ": " + (data as any).details : ""));
        success++;
      } catch (e: any) {
        failures.push({ id, msg: e.message || "خطأ" });
      }
    }
    if (failures.length === 0) {
      toast({ title: "تمت المزامنة", description: `تم جلب ${success} طلب بنجاح` });
      setSyncOrderId("");
    } else {
      toast({
        title: `نجح ${success} / فشل ${failures.length}`,
        description: failures.slice(0, 5).map((f) => `${f.id}: ${f.msg}`).join("\n"),
        variant: "destructive",
      });
    }
    setSyncing(false);
  };

  const saveApiKey = async () => {
    if (!user) return;
    setSavingApiKey(true);
    const { error } = await supabase
      .from("profiles")
      .update({ easyorders_api_key: easyOrdersKey.trim() || null } as any)
      .eq("user_id", user.id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else toast({ title: "تم الحفظ", description: "تم حفظ مفتاح EasyOrders API" });
    setSavingApiKey(false);
  };

  const rotateToken = async () => {
    if (!user) return;
    if (!confirm("سيتم إبطال الرمز الحالي. هل تريد المتابعة؟")) return;
    setRotating(true);
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase.from("profiles").update({ webhook_token: newToken } as any).eq("user_id", user.id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { setWebhookToken(newToken); toast({ title: "تم التحديث", description: "تم توليد رمز جديد" }); }
    setRotating(false);
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "تم النسخ" });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Webhook className="w-5 h-5" /> Webhook لاستقبال طلبات خارجية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            استخدم هذا الرابط لإرسال طلبات تلقائياً من أي نظام خارجي (Zapier، Make، أو موقعك الخاص). أرسل طلب POST بصيغة JSON.
          </p>
          <div className="space-y-2">
            <Label>رابط Webhook</Label>
            <div className="flex gap-2">
              <Input dir="ltr" readOnly value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-order?token=${webhookToken}`} />
              <Button type="button" variant="outline" size="icon" onClick={() => copy(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-order?token=${webhookToken}`)}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>الرمز السري (Token)</Label>
            <div className="flex gap-2">
              <Input dir="ltr" readOnly value={webhookToken} />
              <Button type="button" variant="outline" size="icon" onClick={() => copy(webhookToken)}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" onClick={rotateToken} disabled={rotating}>
                {rotating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span className="mr-2">توليد رمز جديد</span>
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>مثال على البيانات (JSON)</Label>
            <pre dir="ltr" className="bg-muted p-3 rounded text-xs overflow-x-auto">{`{
  "customer_name": "أحمد",
  "phone": "0922000000",
  "city": "طرابلس",
  "address": "حي الأندلس",
  "total": 150,
  "quantity": 1,
  "products": "اسم المنتج"
}`}</pre>
          </div>
          <p className="text-xs text-muted-foreground">
            الحقول الإلزامية: <code>phone</code>, <code>city</code>, <code>address</code>. ستظهر الطلبات تلقائياً في صفحة الطلبات بحالة "جديد".
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تكامل EasyOrders API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            عند تفعيل هذا المفتاح، سيقوم النظام تلقائياً بجلب التفاصيل الكاملة لأي طلب وارد من EasyOrders عبر Webhook (المنتجات، الكميات، المتغيرات).
            احصل على المفتاح من EasyOrders ← Public API ← Create New API Key (مع صلاحية orders:read).
          </p>
          <div className="space-y-2">
            <Label>EasyOrders Api-Key</Label>
            <div className="flex gap-2">
              <Input
                dir="ltr"
                type="password"
                value={easyOrdersKey}
                onChange={(e) => setEasyOrdersKey(e.target.value)}
                placeholder="••••••••••••••••"
              />
              <Button onClick={saveApiKey} disabled={savingApiKey}>
                {savingApiKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="mr-2">حفظ</span>
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <Label>مزامنة طلبات يدوياً (Order IDs)</Label>
            <Textarea
              dir="ltr"
              value={syncOrderId}
              onChange={(e) => setSyncOrderId(e.target.value)}
              placeholder={"2692e31f-27f6-472d-b4cd-c0c1c168511c\nc0c1c168-...\n..."}
              rows={4}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                أدخل رقم طلب أو عدة أرقام (مفصولة بمسافة، فاصلة، أو سطر جديد).
              </p>
              <Button onClick={syncOrder} disabled={syncing || !easyOrdersKey}>
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span className="mr-2">جلب</span>
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <Label>مزامنة منتجات EasyOrders</Label>
            <div className="flex items-center gap-2">
              <Button onClick={syncProducts} disabled={syncingProducts || !easyOrdersKey}>
                {syncingProducts ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span className="mr-2">مزامنة المنتجات الآن</span>
              </Button>
              <span className="text-sm text-muted-foreground">المنتجات المحفوظة: {eoProductsCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              تجلب جميع المنتجات والمتغيرات من EasyOrders. ثم اربط كل متغير محلي بمتغير EasyOrders من شاشة المنتج.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationsPanel;
