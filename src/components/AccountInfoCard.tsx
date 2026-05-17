import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

const AccountInfoCard = () => {
  const { user } = useAuth();
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
    return <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const storeUrl = `${window.location.origin}/store/${username || originalUsername}`;

  return (
    <Card dir="rtl">
      <CardHeader><CardTitle>بيانات الحساب</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>اسم المتجر (يظهر في رابط المتجر)</Label>
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
  );
};

export default AccountInfoCard;
