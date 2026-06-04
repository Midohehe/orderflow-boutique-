import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Megaphone, Plus, Loader2, Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { useStoreContext } from "@/hooks/useStoreContext";

interface AdWallet { id: string; name: string; platform: string; currency: string; balance: number; avg_cost_rate: number; is_active: boolean; }
interface Safe { id: string; name: string; balance: number; }
interface Product { id: string; name: string; }
interface Topup { id: string; wallet_id: string; safe_id: string; amount_foreign: number; exchange_rate: number; amount_local: number; notes: string | null; created_at: string; }
interface Spend { id: string; wallet_id: string; product_id: string | null; campaign_name: string | null; amount_foreign: number; cost_rate: number; amount_local: number; spend_date: string; notes: string | null; created_at: string; }

const PLATFORMS = [
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "google", label: "Google" },
  { value: "snapchat", label: "Snapchat" },
  { value: "other", label: "أخرى" },
];

const fmt = (n: number, d = 2) => Number(n || 0).toLocaleString("ar-LY", { minimumFractionDigits: d, maximumFractionDigits: d });

const AdWallets = () => {
  const { activeStoreId } = useStoreContext();
  const [wallets, setWallets] = useState<AdWallet[]>([]);
  const [safes, setSafes] = useState<Safe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [spends, setSpends] = useState<Spend[]>([]);
  const [loading, setLoading] = useState(true);

  // Create wallet dialog
  const [wOpen, setWOpen] = useState(false);
  const [wName, setWName] = useState("");
  const [wPlatform, setWPlatform] = useState("facebook");
  const [wCurrency, setWCurrency] = useState("USD");

  // Topup form
  const [tWallet, setTWallet] = useState("");
  const [tSafe, setTSafe] = useState("");
  const [tAmount, setTAmount] = useState("");
  const [tRate, setTRate] = useState("");
  const [tNotes, setTNotes] = useState("");
  const [tSaving, setTSaving] = useState(false);

  // Spend form
  const [sWallet, setSWallet] = useState("");
  const [sProduct, setSProduct] = useState("");
  const [sCampaign, setSCampaign] = useState("");
  const [sAmount, setSAmount] = useState("");
  const [sDate, setSDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sNotes, setSNotes] = useState("");
  const [sSaving, setSSaving] = useState(false);

  const load = async () => {
    if (!activeStoreId) { setLoading(false); return; }
    setLoading(true);
    const [w, sa, pr, tu, sp] = await Promise.all([
      supabase.from("ad_wallets").select("*").eq("store_id", activeStoreId).order("created_at"),
      supabase.from("safes").select("id, name, balance").eq("store_id", activeStoreId).order("created_at"),
      supabase.from("products").select("id, name").eq("store_id", activeStoreId).is("deleted_at", null).order("name"),
      supabase.from("ad_wallet_topups").select("*").eq("store_id", activeStoreId).order("created_at", { ascending: false }),
      supabase.from("ad_spends").select("*").eq("store_id", activeStoreId).order("spend_date", { ascending: false }),
    ]);
    setWallets((w.data as AdWallet[]) || []);
    setSafes((sa.data as Safe[]) || []);
    setProducts((pr.data as Product[]) || []);
    setTopups((tu.data as Topup[]) || []);
    setSpends((sp.data as Spend[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [activeStoreId]);

  const createWallet = async () => {
    if (!wName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("ad_wallets").insert({
      name: wName.trim(), platform: wPlatform, currency: wCurrency.toUpperCase().trim() || "USD",
      owner_id: user!.id, store_id: activeStoreId,
    });
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم إنشاء المحفظة" });
    setWName(""); setWPlatform("facebook"); setWCurrency("USD"); setWOpen(false);
    load();
  };

  const submitTopup = async () => {
    const amt = Number(tAmount); const rate = Number(tRate);
    if (!tWallet || !tSafe || !amt || amt <= 0 || !rate || rate <= 0) return;
    const wallet = wallets.find(w => w.id === tWallet);
    const safe = safes.find(s => s.id === tSafe);
    if (!wallet || !safe) return;
    setTSaving(true);
    const amountLocal = amt * rate;
    const { data: { user } } = await supabase.auth.getUser();

    // 1) Insert topup
    const { error: e1 } = await supabase.from("ad_wallet_topups").insert({
      wallet_id: tWallet, safe_id: tSafe, amount_foreign: amt, exchange_rate: rate, amount_local: amountLocal,
      notes: tNotes || null, owner_id: user!.id, store_id: activeStoreId, created_by: user!.id,
    });
    if (e1) { toast({ title: "خطأ", description: e1.message, variant: "destructive" }); setTSaving(false); return; }

    // 2) Safe movement (balance updated via sync_safe_balance trigger)
    const { error: e2 } = await supabase.from("safe_movements").insert({
      safe_id: tSafe, amount: -amountLocal, movement_type: "ad_topup",
      notes: `شحن محفظة إعلانات: ${wallet.name} (${amt} ${wallet.currency} @ ${rate})`,
      owner_id: user!.id, store_id: activeStoreId,
    });
    if (e2) { toast({ title: "خطأ", description: e2.message, variant: "destructive" }); setTSaving(false); return; }
    // 3) Update wallet balance + weighted avg cost rate
    const oldBal = Number(wallet.balance);
    const oldAvg = Number(wallet.avg_cost_rate) || 0;
    const newBal = oldBal + amt;
    const newAvg = newBal > 0 ? ((oldBal * oldAvg) + (amt * rate)) / newBal : rate;
    await supabase.from("ad_wallets").update({ balance: newBal, avg_cost_rate: newAvg }).eq("id", tWallet);

    toast({ title: "تم شحن المحفظة" });
    setTAmount(""); setTRate(""); setTNotes("");
    setTSaving(false);
    load();
  };

  const submitSpend = async () => {
    const amt = Number(sAmount);
    if (!sWallet || !amt || amt <= 0) return;
    const wallet = wallets.find(w => w.id === sWallet);
    if (!wallet) return;
    if (Number(wallet.balance) < amt) {
      toast({ title: "رصيد غير كافٍ", description: `الرصيد المتاح: ${fmt(wallet.balance)} ${wallet.currency}`, variant: "destructive" });
      return;
    }
    setSSaving(true);
    const rate = Number(wallet.avg_cost_rate) || 0;
    if (rate <= 0) {
      toast({ title: "لا يوجد سعر تكلفة", description: "قم بشحن المحفظة أولاً ليُحدد متوسط سعر التكلفة", variant: "destructive" });
      setSSaving(false); return;
    }
    const amountLocal = amt * rate;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("ad_spends").insert({
      wallet_id: sWallet, product_id: sProduct || null, campaign_name: sCampaign.trim() || null,
      amount_foreign: amt, cost_rate: rate, amount_local: amountLocal,
      spend_date: sDate, notes: sNotes || null,
      owner_id: user!.id, store_id: activeStoreId, created_by: user!.id,
    });
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); setSSaving(false); return; }
    await supabase.from("ad_wallets").update({ balance: Number(wallet.balance) - amt }).eq("id", sWallet);

    toast({ title: "تم تسجيل الاستهلاك" });
    setSAmount(""); setSCampaign(""); setSProduct(""); setSNotes("");
    setSSaving(false);
    load();
  };

  const totals = useMemo(() => {
    const totalTopupLocal = topups.reduce((s, t) => s + Number(t.amount_local), 0);
    const totalSpendLocal = spends.reduce((s, sp) => s + Number(sp.amount_local), 0);
    const totalBalanceLocal = wallets.reduce((s, w) => s + Number(w.balance) * Number(w.avg_cost_rate || 0), 0);
    return { totalTopupLocal, totalSpendLocal, totalBalanceLocal };
  }, [topups, spends, wallets]);

  const spendByCampaign = useMemo(() => {
    const map: Record<string, { amount_foreign: number; amount_local: number; count: number }> = {};
    spends.forEach(s => {
      const k = s.campaign_name || "بدون حملة";
      if (!map[k]) map[k] = { amount_foreign: 0, amount_local: 0, count: 0 };
      map[k].amount_foreign += Number(s.amount_foreign);
      map[k].amount_local += Number(s.amount_local);
      map[k].count += 1;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount_local - a.amount_local);
  }, [spends]);

  const spendByProduct = useMemo(() => {
    const map: Record<string, { amount_local: number; amount_foreign: number; count: number; name: string }> = {};
    spends.forEach(s => {
      const k = s.product_id || "none";
      const name = s.product_id ? (products.find(p => p.id === s.product_id)?.name || "—") : "بدون منتج";
      if (!map[k]) map[k] = { amount_local: 0, amount_foreign: 0, count: 0, name };
      map[k].amount_local += Number(s.amount_local);
      map[k].amount_foreign += Number(s.amount_foreign);
      map[k].count += 1;
    });
    return Object.values(map).sort((a, b) => b.amount_local - a.amount_local);
  }, [spends, products]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const walletName = (id: string) => wallets.find(w => w.id === id)?.name || "-";
  const safeName = (id: string) => safes.find(s => s.id === id)?.name || "-";
  const productName = (id: string | null) => id ? (products.find(p => p.id === id)?.name || "-") : "-";

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageHeader
        icon={Megaphone}
        title="محافظ الإعلانات"
        description="افصل شحن رصيد الإعلانات عن الاستهلاك الفعلي للحصول على أرباح دقيقة"
        iconGradient="from-fuchsia-500 to-purple-600"
        action={
          <Button onClick={() => setWOpen(true)} className="shadow-md bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700">
            <Plus className="w-4 h-4" />محفظة جديدة
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="flex justify-between items-start"><div><p className="text-xs text-muted-foreground">عدد المحافظ</p><p className="text-xl font-bold">{wallets.length}</p></div><WalletIcon className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex justify-between items-start"><div><p className="text-xs text-muted-foreground">إجمالي الشحن (دينار)</p><p className="text-xl font-bold text-blue-600">{fmt(totals.totalTopupLocal)}</p></div><ArrowDownCircle className="w-5 h-5 text-blue-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex justify-between items-start"><div><p className="text-xs text-muted-foreground">إجمالي الاستهلاك (دينار)</p><p className="text-xl font-bold text-red-500">{fmt(totals.totalSpendLocal)}</p></div><ArrowUpCircle className="w-5 h-5 text-red-500" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex justify-between items-start"><div><p className="text-xs text-muted-foreground">رصيد المحافظ (دينار)</p><p className="text-xl font-bold text-green-600">{fmt(totals.totalBalanceLocal)}</p></div><TrendingUp className="w-5 h-5 text-green-500" /></div></CardContent></Card>
      </div>

      <Tabs defaultValue="wallets">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="wallets">المحافظ</TabsTrigger>
          <TabsTrigger value="topup">شحن رصيد</TabsTrigger>
          <TabsTrigger value="spend">تسجيل استهلاك</TabsTrigger>
          <TabsTrigger value="history">سجل الحركات</TabsTrigger>
          <TabsTrigger value="reports">التقارير</TabsTrigger>
        </TabsList>

        {/* Wallets list */}
        <TabsContent value="wallets" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {wallets.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">لا توجد محافظ — أنشئ محفظة جديدة</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">المنصة</TableHead>
                    <TableHead className="text-right">العملة</TableHead>
                    <TableHead className="text-right">الرصيد</TableHead>
                    <TableHead className="text-right">متوسط سعر التكلفة</TableHead>
                    <TableHead className="text-right">قيمة الرصيد بالدينار</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {wallets.map(w => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell>{PLATFORMS.find(p => p.value === w.platform)?.label || w.platform}</TableCell>
                        <TableCell>{w.currency}</TableCell>
                        <TableCell className="font-bold text-green-600">{fmt(w.balance)}</TableCell>
                        <TableCell>{fmt(w.avg_cost_rate, 4)}</TableCell>
                        <TableCell className="font-bold">{fmt(Number(w.balance) * Number(w.avg_cost_rate || 0))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Topup */}
        <TabsContent value="topup" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">شحن رصيد محفظة</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>المحفظة</Label>
                <Select value={tWallet} onValueChange={setTWallet}>
                  <SelectTrigger><SelectValue placeholder="اختر المحفظة" /></SelectTrigger>
                  <SelectContent>{wallets.map(w => <SelectItem key={w.id} value={w.id}>{w.name} ({w.currency})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>الخزينة (المخصوم منها بالدينار)</Label>
                <Select value={tSafe} onValueChange={setTSafe}>
                  <SelectTrigger><SelectValue placeholder="اختر الخزينة" /></SelectTrigger>
                  <SelectContent>{safes.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({fmt(s.balance)})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>القيمة بالعملة الأجنبية</Label>
                <Input type="number" step="0.01" value={tAmount} onChange={e => setTAmount(e.target.value)} placeholder="مثلاً 100" />
              </div>
              <div>
                <Label>سعر الصرف (دينار لكل وحدة عملة)</Label>
                <Input type="number" step="0.0001" value={tRate} onChange={e => setTRate(e.target.value)} placeholder="مثلاً 5.4" />
              </div>
              <div className="md:col-span-2">
                <Label>الإجمالي بالدينار (يُحسب تلقائياً)</Label>
                <Input value={tAmount && tRate ? fmt(Number(tAmount) * Number(tRate)) : ""} readOnly className="bg-muted/40 font-bold" />
              </div>
              <div className="md:col-span-2">
                <Label>ملاحظات</Label>
                <Textarea value={tNotes} onChange={e => setTNotes(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={submitTopup} disabled={tSaving || !tWallet || !tSafe || !tAmount || !tRate} className="w-full">
                  {tSaving && <Loader2 className="w-4 h-4 animate-spin" />}شحن المحفظة
                </Button>
                <p className="text-xs text-muted-foreground mt-2">ملاحظة: عملية الشحن لا تُحسب كمصروف على الأرباح. يُحتسب المصروف فقط عند تسجيل الاستهلاك.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Spend */}
        <TabsContent value="spend" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">تسجيل استهلاك إعلاني</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>المحفظة</Label>
                <Select value={sWallet} onValueChange={setSWallet}>
                  <SelectTrigger><SelectValue placeholder="اختر المحفظة" /></SelectTrigger>
                  <SelectContent>{wallets.map(w => <SelectItem key={w.id} value={w.id}>{w.name} — رصيد {fmt(w.balance)} {w.currency}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>المنتج المرتبط</Label>
                <Select value={sProduct} onValueChange={setSProduct}>
                  <SelectTrigger><SelectValue placeholder="(اختياري)" /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>اسم الحملة</Label>
                <Input value={sCampaign} onChange={e => setSCampaign(e.target.value)} placeholder="اسم الحملة الإعلانية" />
              </div>
              <div>
                <Label>قيمة الاستهلاك بالعملة الأجنبية</Label>
                <Input type="number" step="0.01" value={sAmount} onChange={e => setSAmount(e.target.value)} />
              </div>
              <div>
                <Label>التاريخ</Label>
                <Input type="date" value={sDate} onChange={e => setSDate(e.target.value)} />
              </div>
              <div>
                <Label>المقابل بالدينار (متوسط السعر)</Label>
                <Input
                  value={(() => {
                    const w = wallets.find(x => x.id === sWallet);
                    if (!w || !sAmount) return "";
                    return fmt(Number(sAmount) * Number(w.avg_cost_rate || 0));
                  })()}
                  readOnly className="bg-muted/40 font-bold"
                />
              </div>
              <div className="md:col-span-2">
                <Label>ملاحظات</Label>
                <Textarea value={sNotes} onChange={e => setSNotes(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={submitSpend} disabled={sSaving || !sWallet || !sAmount} className="w-full">
                  {sSaving && <Loader2 className="w-4 h-4 animate-spin" />}تسجيل الاستهلاك
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowDownCircle className="w-4 h-4 text-blue-500" />سجل الشحن</CardTitle></CardHeader>
            <CardContent className="p-0">
              {topups.length === 0 ? <p className="text-center text-muted-foreground py-8">لا توجد عمليات شحن</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">المحفظة</TableHead>
                    <TableHead className="text-right">الخزينة</TableHead>
                    <TableHead className="text-right">المبلغ الأجنبي</TableHead>
                    <TableHead className="text-right">سعر الصرف</TableHead>
                    <TableHead className="text-right">الإجمالي بالدينار</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {topups.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString("ar-LY")}</TableCell>
                        <TableCell>{walletName(t.wallet_id)}</TableCell>
                        <TableCell>{safeName(t.safe_id)}</TableCell>
                        <TableCell className="font-bold text-blue-600">{fmt(t.amount_foreign)}</TableCell>
                        <TableCell>{fmt(t.exchange_rate, 4)}</TableCell>
                        <TableCell className="font-bold">{fmt(t.amount_local)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowUpCircle className="w-4 h-4 text-red-500" />سجل الاستهلاك</CardTitle></CardHeader>
            <CardContent className="p-0">
              {spends.length === 0 ? <p className="text-center text-muted-foreground py-8">لا توجد عمليات استهلاك</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">المحفظة</TableHead>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right">الحملة</TableHead>
                    <TableHead className="text-right">المبلغ الأجنبي</TableHead>
                    <TableHead className="text-right">سعر التكلفة</TableHead>
                    <TableHead className="text-right">المصروف بالدينار</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {spends.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs">{s.spend_date}</TableCell>
                        <TableCell>{walletName(s.wallet_id)}</TableCell>
                        <TableCell>{productName(s.product_id)}</TableCell>
                        <TableCell>{s.campaign_name || "-"}</TableCell>
                        <TableCell className="font-bold text-red-500">{fmt(s.amount_foreign)}</TableCell>
                        <TableCell>{fmt(s.cost_rate, 4)}</TableCell>
                        <TableCell className="font-bold text-red-600">{fmt(s.amount_local)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">مصروفات الإعلانات حسب الحملة</CardTitle></CardHeader>
            <CardContent className="p-0">
              {spendByCampaign.length === 0 ? <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-right">الحملة</TableHead>
                    <TableHead className="text-right">عدد الحركات</TableHead>
                    <TableHead className="text-right">إجمالي بالعملة الأجنبية</TableHead>
                    <TableHead className="text-right">إجمالي بالدينار</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {spendByCampaign.map(c => (
                      <TableRow key={c.name}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.count}</TableCell>
                        <TableCell>{fmt(c.amount_foreign)}</TableCell>
                        <TableCell className="font-bold text-red-600">{fmt(c.amount_local)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">مصروفات الإعلانات حسب المنتج</CardTitle></CardHeader>
            <CardContent className="p-0">
              {spendByProduct.length === 0 ? <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right">عدد الحركات</TableHead>
                    <TableHead className="text-right">إجمالي بالعملة الأجنبية</TableHead>
                    <TableHead className="text-right">إجمالي بالدينار</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {spendByProduct.map(p => (
                      <TableRow key={p.name}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.count}</TableCell>
                        <TableCell>{fmt(p.amount_foreign)}</TableCell>
                        <TableCell className="font-bold text-red-600">{fmt(p.amount_local)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create wallet dialog */}
      <Dialog open={wOpen} onOpenChange={setWOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>محفظة إعلانات جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الاسم</Label><Input value={wName} onChange={e => setWName(e.target.value)} placeholder="مثلاً: Facebook Ads" /></div>
            <div>
              <Label>المنصة</Label>
              <Select value={wPlatform} onValueChange={setWPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>العملة</Label><Input value={wCurrency} onChange={e => setWCurrency(e.target.value)} placeholder="USD" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWOpen(false)}>إلغاء</Button>
            <Button onClick={createWallet} disabled={!wName.trim()}>إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdWallets;