import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Wallet as WalletIcon, CreditCard, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

interface Tx {
  id: string;
  amount: number;
  type: string;
  notes: string | null;
  created_at: string;
}

const Wallet = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("د.ل");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [w, t, s] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase.from("wallet_transactions").select("id, amount, type, notes, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("app_settings").select("subscription_currency").limit(1).maybeSingle(),
    ]);
    setBalance(Number(w.data?.balance ?? 0));
    setTxs((t.data as Tx[]) || []);
    if (s.data?.subscription_currency) setCurrency(s.data.subscription_currency);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleRedeem = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setRedeeming(true);
    try {
      const { data, error } = await supabase.rpc("redeem_card", { _code: c });
      if (error) throw error;
      const res = data as any;
      if (!res?.success) {
        const err = res?.error === "card_not_found" ? "الكرت غير موجود" : res?.error === "card_used" ? "الكرت مستخدم مسبقاً" : "تعذر استبدال الكرت";
        toast({ title: "خطأ", description: err, variant: "destructive" });
        return;
      }
      toast({ title: "تم الشحن", description: `تمت إضافة ${res.amount} ${currency} إلى محفظتك` });
      setCode("");
      load();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader icon={WalletIcon} title="المحفظة" description="رصيدك وعمليات الشحن والخصم" iconGradient="from-emerald-500 to-teal-600" />

      <Card className={balance < 0 ? "border-destructive" : ""}>
        <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">الرصيد الحالي</p>
            <p className={`text-4xl font-bold ${balance < 0 ? "text-destructive" : "text-primary"}`}>
              {balance.toLocaleString()} <span className="text-lg">{currency}</span>
            </p>
            {balance < 0 && (
              <p className="text-xs text-destructive mt-2">⚠️ رصيدك سالب — قم بشحن المحفظة لاستئناف العمل</p>
            )}
          </div>
          <WalletIcon className="w-16 h-16 text-primary/30" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" /> شحن المحفظة بكرت</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Label>كود الكرت</Label>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ادخل كود الكرت" className="font-mono" />
            <Button onClick={handleRedeem} disabled={redeeming || !code.trim()}>
              {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : "شحن"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>حركات المحفظة</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {txs.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">لا توجد حركات بعد</p>
          ) : txs.map((t) => (
            <div key={t.id} className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-3">
                {t.amount >= 0 ? <ArrowUpCircle className="w-5 h-5 text-success" /> : <ArrowDownCircle className="w-5 h-5 text-destructive" />}
                <div>
                  <p className="text-sm">{t.notes || (t.type === "recharge" ? "شحن" : t.type === "order_fee" ? "رسوم طلب" : t.type)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("ar")}</p>
                </div>
              </div>
              <Badge variant={t.amount >= 0 ? "default" : "destructive"} className="font-mono">
                {t.amount >= 0 ? "+" : ""}{Number(t.amount).toLocaleString()} {currency}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Wallet;