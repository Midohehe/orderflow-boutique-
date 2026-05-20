import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface Props {
  storeId: string;
  initialEnabled: boolean;
  onChange?: (v: boolean) => void;
}

export default function StorePushToggle({ storeId, initialEnabled, onChange }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [savingFlag, setSavingFlag] = useState(false);
  const [testing, setTesting] = useState(false);
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushNotifications(storeId);

  useEffect(() => setEnabled(initialEnabled), [initialEnabled]);

  const toggleStoreFlag = async (next: boolean) => {
    setSavingFlag(true);
    try {
      const { error } = await supabase.from("stores").update({ push_enabled: next }).eq("id", storeId);
      if (error) throw error;
      setEnabled(next);
      onChange?.(next);
      if (next && !subscribed) await subscribe();
      toast({ title: next ? "تم تفعيل الإشعارات لهذا المتجر" : "تم إيقاف الإشعارات" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSavingFlag(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke("send-push", {
        body: { store_id: storeId, title: "🔔 اختبار", body: "الإشعارات تعمل بنجاح", url: "/dashboard" },
      });
      if (error) throw error;
      toast({ title: "تم الإرسال", description: "تحقق من الإشعارات." });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-md border bg-muted/30 p-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          {enabled ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
          <span>إشعارات الطلبات</span>
        </div>
        <Switch checked={enabled} onCheckedChange={toggleStoreFlag} disabled={savingFlag || loading} />
      </div>
      {!supported && (
        <p className="text-[11px] text-muted-foreground">
          متصفحك لا يدعم الإشعارات. على iPhone ثبّت التطبيق على الشاشة الرئيسية أولاً.
        </p>
      )}
      {enabled && supported && (
        <div className="flex items-center gap-2">
          {!subscribed ? (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={subscribe} disabled={loading}>
              {loading ? <Loader2 className="w-3 h-3 ml-1 animate-spin" /> : null}
              تفعيل على هذا الجهاز
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={sendTest} disabled={testing}>
                {testing ? <Loader2 className="w-3 h-3 ml-1 animate-spin" /> : null}
                إرسال اختبار
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={unsubscribe} disabled={loading}>
                إلغاء من هذا الجهاز
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}