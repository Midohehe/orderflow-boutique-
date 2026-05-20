import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Facebook } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const AdminFacebookApp = () => {
  const { isAdmin, loading: ctxLoading } = useUserContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");

  useEffect(() => {
    if (ctxLoading) return;
    if (!isAdmin) { setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from("facebook_app_config" as any)
        .select("id, app_id, app_secret")
        .limit(1)
        .maybeSingle();
      if (error) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
      } else if (data) {
        setRowId((data as any).id);
        setAppId((data as any).app_id || "");
        setAppSecret((data as any).app_secret || "");
      }
      setLoading(false);
    })();
  }, [isAdmin, ctxLoading]);

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      app_id: appId.trim() || null,
      app_secret: appSecret.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: user?.id,
    };
    let error;
    if (rowId) {
      ({ error } = await supabase.from("facebook_app_config" as any).update(payload).eq("id", rowId));
    } else {
      const { data, error: e } = await supabase.from("facebook_app_config" as any).insert(payload).select("id").single();
      error = e;
      if (data) setRowId((data as any).id);
    }
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else toast({ title: "تم الحفظ", description: "تم حفظ بيانات تطبيق فيسبوك" });
    setSaving(false);
  };

  if (ctxLoading || loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">هذه الصفحة متاحة للأدمن فقط</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#1877F2] text-white flex items-center justify-center shadow-md">
          <Facebook className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">تطبيق فيسبوك (Admin)</h1>
          <p className="text-sm text-muted-foreground">إعدادات تطبيق فيسبوك المستخدم لربط حسابات الإعلانات</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>بيانات تطبيق فيسبوك</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>App ID</Label>
            <Input dir="ltr" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="1234567890" className="font-mono" />
          </div>
          <div className="space-y-2">
            <Label>App Secret</Label>
            <Input dir="ltr" type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="••••••••••••••••" className="font-mono" />
            <p className="text-xs text-muted-foreground">يُحفظ بشكل آمن ولا يُعرض إلا للأدمن.</p>
          </div>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFacebookApp;