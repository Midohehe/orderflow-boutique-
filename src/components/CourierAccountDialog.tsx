import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import { toast } from "@/hooks/use-toast";

export function CourierAccountDialog({ courierId }: { courierId: string }) {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const account = useQuery({ queryKey: ["courier-account", courierId], enabled: open, queryFn: async () => {
    const { data, error } = await supabase.from("courier_accounts").select("username").eq("courier_id", courierId).maybeSingle();
    if (error) throw error;
    return data;
  } });
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy || account.isPending || account.isError) return;
    setBusy(true); setErrorText("");
    try {
      const { data, error } = await supabase.functions.invoke("courier-account", { body: { courier_id: courierId, action: account.data ? "reset_password" : "create", username, password } });
      if (error) throw new Error(await getEdgeFunctionErrorMessage(error));
      if (data?.error) throw new Error(data.error);
      await cache.invalidateQueries({ queryKey: ["courier-account", courierId] });
      setPassword(""); toast({ title: account.data ? "تم تغيير كلمة المرور" : "تم إنشاء حساب المندوب" });
    } catch (error) { setErrorText(error instanceof Error ? error.message : "تعذّر حفظ الحساب"); }
    finally { setBusy(false); }
  }
  return <><Button variant="outline" onClick={() => { setOpen(true); setErrorText(""); }}>حساب دخول المندوب</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) { setOpen(value); setPassword(""); } }}><DialogContent dir="rtl"><DialogTitle>حساب المندوب</DialogTitle><DialogDescription>يشاهد المندوب طلباته فقط ويحدّث حالتها الفرعية، دون صلاحية التسوية المالية.</DialogDescription>
      {account.isPending ? <p>جاري التحميل...</p> : account.isError ? <Button onClick={() => void account.refetch()}>إعادة المحاولة</Button> : <form onSubmit={save} className="space-y-4">
        <p className="text-sm break-all">رابط الدخول: <a className="underline" href="/courier">{window.location.origin}/courier</a></p>
        <div><Label htmlFor={`username-${courierId}`}>اسم المستخدم</Label><Input id={`username-${courierId}`} dir="ltr" required pattern="[a-zA-Z0-9_]{3,30}" minLength={3} maxLength={30} value={account.data?.username || username} disabled={busy || !!account.data} autoComplete="off" onChange={e => setUsername(e.target.value)} /></div>
        <div><Label htmlFor={`password-${courierId}`}>{account.data ? "كلمة مرور جديدة" : "كلمة المرور"}</Label><Input id={`password-${courierId}`} type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /></div>
        {errorText && <p role="alert" className="text-destructive">{errorText}</p>}
        <Button disabled={busy} type="submit">{busy ? "جاري الحفظ..." : account.data ? "تغيير كلمة المرور" : "إنشاء الحساب"}</Button>
      </form>}
    </DialogContent></Dialog></>;
}
