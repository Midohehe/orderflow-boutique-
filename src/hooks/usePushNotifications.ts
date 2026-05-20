import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Public VAPID key — safe to expose in client.
const VAPID_PUBLIC_KEY =
  "BBf44RF_73ThgO0auOeH_XJMvXmDea3P98CYuLQUtgWqM-m9k2NvZEaM-g2sw9-AaRRfkD1_KIOhdPHSmCnwwLE";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

async function registerSW(): Promise<ServiceWorkerRegistration> {
  // First, clear out the legacy kill-switch worker registered at /sw.js
  try {
    const all = await navigator.serviceWorker.getRegistrations();
    for (const r of all) {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      if (url.endsWith("/sw.js")) await r.unregister();
    }
  } catch {}
  return navigator.serviceWorker.register("/push-sw.js");
}

export function usePushNotifications(storeId: string | null) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const supported = isPushSupported();

  const refresh = useCallback(async () => {
    if (!supported) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch {
      setSubscribed(false);
    }
  }, [supported]);

  useEffect(() => { refresh(); }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!supported) {
      toast({ title: "غير مدعوم", description: "متصفحك لا يدعم الإشعارات. على iPhone ثبّت التطبيق على الشاشة الرئيسية أولاً.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast({ title: "تم رفض الإذن", description: "فعّل الإشعارات من إعدادات المتصفح.", variant: "destructive" });
        return;
      }
      const reg = await registerSW();
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON();
      const { error } = await supabase.functions.invoke("push-subscribe", {
        body: { subscription: json, store_id: storeId, action: "subscribe" },
      });
      if (error) throw error;
      setSubscribed(true);
      toast({ title: "تم التفعيل ✅", description: "ستصلك الإشعارات الآن." });
    } catch (e: any) {
      console.error(e);
      toast({ title: "فشل التفعيل", description: e?.message || "تعذر تفعيل الإشعارات", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [supported, storeId]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.functions.invoke("push-subscribe", {
          body: { subscription: sub.toJSON(), action: "unsubscribe" },
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast({ title: "تم إيقاف الإشعارات" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "تعذر الإيقاف", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  return { supported, subscribed, loading, subscribe, unsubscribe, refresh };
}