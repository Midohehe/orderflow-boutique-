import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, UserCircle } from "lucide-react";
import CityCorrections from "@/components/CityCorrections";
import { useUserContext } from "@/hooks/useUserContext";

const AccountSettings = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setUsername(data.username || "");
        setFullName(data.full_name || "");
        setOriginalUsername(data.username || "");
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!cleanUsername) {
      toast({ title: "خطأ", description: "اسم المستخدم مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (cleanUsername !== originalUsername) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("username", cleanUsername)
          .maybeSingle();
        if (existing && existing.user_id !== user.id) {
          toast({ title: "خطأ", description: "اسم المستخدم محجوز", variant: "destructive" });
          setSaving(false);
          return;
        }
      }
      const { error } = await supabase
        .from("profiles")
        .update({ username: cleanUsername, full_name: fullName || null })
        .eq("user_id", user.id);
      if (error) throw error;
      setOriginalUsername(cleanUsername);
      setUsername(cleanUsername);
      toast({ title: "تم الحفظ", description: "تم تحديث بيانات الحساب" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const storeUrl = `${window.location.origin}/store/${username || originalUsername}`;

  return (
    <div className="space-y-6 max-w-2xl" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><UserCircle className="w-7 h-7" /> حسابي</h1>
        <p className="text-muted-foreground">عدّل اسم المستخدم ورابط متجرك</p>
      </div>

      <Card>
        <CardHeader><CardTitle>بيانات الحساب</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>اسم المستخدم (يظهر في رابط المتجر)</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              placeholder="ahmed"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground break-all">رابط متجرك: {storeUrl}</p>
          </div>
          <div className="space-y-2">
            <Label>الاسم الكامل</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
            حفظ التغييرات
          </Button>
        </CardContent>
      </Card>

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
            احصل على المفتاح من EasyOrders → Public API → Create New API Key (مع صلاحية orders:read).
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

      {isAdmin && <CityCorrections />}
    </div>
  );
};

export default AccountSettings;
