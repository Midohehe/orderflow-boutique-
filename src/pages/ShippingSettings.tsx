import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2, Truck, RefreshCw, Copy, Plus, Trash2, GripVertical, Package, CheckCircle2, AlertCircle } from "lucide-react";
import { useUserContext } from "@/hooks/useUserContext";
import { useStoreContext } from "@/hooks/useStoreContext";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionError";

interface ShippingSettings {
  id?: string;
  email: string;
  password: string;
  endpoint: string;
  enabled: boolean;
  auto_mark_delivered: boolean;
}

const DEFAULT: ShippingSettings = {
  email: "",
  password: "",
  endpoint: "https://turboex.ly:8001/graphql",
  enabled: false,
  auto_mark_delivered: true,
};

const ShippingSettingsPage = () => {
  const { isAdmin } = useUserContext();
  const { activeStoreId } = useStoreContext();
  const [settings, setSettings] = useState<ShippingSettings>(DEFAULT);
  const [globalEndpoint, setGlobalEndpoint] = useState<string>("https://turboex.ly:8001/graphql");
  const [savingEndpoint, setSavingEndpoint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [whCount, setWhCount] = useState<number>(0);
  const [whProducts, setWhProducts] = useState<Array<{ external_id: number; code: string | null; name: string | null; stock: number; synced_at: string }>>([]);
  const [linkedMap, setLinkedMap] = useState<Map<string, Array<{ productName: string; variantKey: string; localStock: number }>>>(new Map());
  const [showCompare, setShowCompare] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [localProducts, setLocalProducts] = useState<Array<{ id: string; name: string; variant_warehouse_codes: Record<string, any>; variant_stock: Record<string, number>; stock: number }>>([]);
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [mappings, setMappings] = useState<Array<{ codes: string; custom_label: string; color: string; category: string; originalCodes: string[] }>>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [savingMappings, setSavingMappings] = useState(false);

  const COLOR_OPTIONS: Array<{ value: string; label: string; cls: string }> = [
    { value: "default", label: "افتراضي", cls: "bg-accent" },
    { value: "blue", label: "أزرق", cls: "bg-blue-500" },
    { value: "sky", label: "سماوي", cls: "bg-sky-400" },
    { value: "indigo", label: "نيلي", cls: "bg-indigo-600" },
    { value: "cyan", label: "تركواز", cls: "bg-cyan-500" },
    { value: "teal", label: "أخضر مزرق", cls: "bg-teal-500" },
    { value: "green", label: "أخضر", cls: "bg-green-600" },
    { value: "lime", label: "ليموني", cls: "bg-lime-500" },
    { value: "emerald", label: "زمردي", cls: "bg-emerald-600" },
    { value: "yellow", label: "أصفر", cls: "bg-yellow-400" },
    { value: "amber", label: "كهرماني", cls: "bg-amber-500" },
    { value: "red", label: "أحمر", cls: "bg-red-600" },
    { value: "rose", label: "وردي داكن", cls: "bg-rose-600" },
    { value: "fuchsia", label: "فوشيا", cls: "bg-fuchsia-600" },
    { value: "purple", label: "بنفسجي", cls: "bg-purple-600" },
    { value: "violet", label: "أرجواني", cls: "bg-violet-600" },
    { value: "orange", label: "برتقالي", cls: "bg-orange-500" },
    { value: "pink", label: "وردي", cls: "bg-pink-500" },
    { value: "brown", label: "بني", cls: "bg-amber-800" },
    { value: "stone", label: "حجري", cls: "bg-stone-500" },
    { value: "slate", label: "رمادي مزرق", cls: "bg-slate-600" },
    { value: "zinc", label: "رصاصي", cls: "bg-zinc-600" },
    { value: "black", label: "أسود", cls: "bg-black" },
    { value: "gray", label: "رمادي", cls: "bg-gray-500" },
  ];

  const DEFAULT_CODES: Array<{ code: string; label: string }> = [
    { code: "PRP", label: "جارى التجهيز" },
    { code: "PRPD", label: "تم التجهيز" },
    { code: "STD", label: "قيد الارسال للمندوب" },
    { code: "DEX", label: "متابعة" },
    { code: "HTR", label: "انتظار لإعادة التوصيل" },
    { code: "PKH", label: "انتظار لإعادة الالتقاط" },
    { code: "DTR", label: "تم التسليم" },
    { code: "DTRC", label: "تم التسليم والتحصيل" },
    { code: "DTRCP", label: "تم التسليم والسداد للعميل" },
    { code: "DTRUC", label: "تم التسليم دون تحصيل" },
    { code: "RTS", label: "راجع" },
    { code: "RTSD", label: "راجع لدى المندوب" },
    { code: "RTSC", label: "راجع لدى الشركة" },
    { code: "OTR", label: "قيد الإرجاع" },
    { code: "RTRN", label: "تم الإرجاع للراسل" },
    { code: "RCV", label: "ارتجاع للمخزن" },
    { code: "UPKBL", label: "جاهز للتفريغ" },
    { code: "UPKBD", label: "تم التفريغ" },
    { code: "UKDB", label: "تم التفريغ" },
    { code: "BMR", label: "مناولة بين الفروع - وارد" },
    { code: "BMT", label: "مناولة بين الفروع - صادر" },
  ];

  const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "none", label: "— لا يحتسب —" },
    { value: "delivered", label: "تم التسليم" },
    { value: "returned", label: "راجع" },
    { value: "in_progress", label: "قيد التنفيذ" },
  ];

  const loadMappings = async () => {
    const [{ data }, { data: hidden }] = await Promise.all([
      supabase
        .from("carrier_status_mappings")
        .select("id, status_code, custom_label, color, sort_order, category")
        .order("sort_order", { ascending: true })
        .order("status_code", { ascending: true }),
      supabase.from("hidden_default_carrier_codes").select("status_code"),
    ]);
    const existing = (data || []) as any[];
    const hiddenSet = new Set(((hidden || []) as any[]).map((h) => h.status_code));
    const existingByCode = new Map<string, any>(existing.map((e) => [e.status_code, e]));

    // Group existing rows by (custom_label || color) so multiple codes that
    // map to the same name+color appear as a single editable row. Track
    // minimum sort_order per group so we can sort by user-defined order.
    const groups = new Map<string, { codes: string[]; custom_label: string; color: string; category: string; sort_order: number }>();
    for (const e of existing) {
      const color = e.color || "default";
      const category = e.category || "none";
      const key = `${e.custom_label}||${color}||${category}`;
      const g = groups.get(key) || {
        codes: [],
        custom_label: e.custom_label,
        color,
        category,
        sort_order: e.sort_order ?? 0,
      };
      g.codes.push(e.status_code);
      g.sort_order = Math.min(g.sort_order, e.sort_order ?? 0);
      groups.set(key, g);
    }

    type Row = { codes: string; custom_label: string; color: string; category: string; originalCodes: string[]; sort_order: number; isDefault: boolean; defaultIdx: number };
    const rows: Row[] = [];
    const usedDefaultCodes = new Set<string>();

    // Add saved groups first (with their stored sort_order)
    for (const g of groups.values()) {
      rows.push({
        codes: g.codes.join(", "),
        custom_label: g.custom_label,
        color: g.color,
        category: g.category,
        originalCodes: [...g.codes],
        sort_order: g.sort_order,
        isDefault: false,
        defaultIdx: -1,
      });
      g.codes.forEach((c) => usedDefaultCodes.add(c));
    }

    // Add default placeholder rows for codes never customized & not hidden
    DEFAULT_CODES.forEach((d, i) => {
      if (hiddenSet.has(d.code)) return;
      if (usedDefaultCodes.has(d.code)) return;
      if (existingByCode.has(d.code)) return;
      rows.push({
        codes: d.code,
        custom_label: d.label,
        color: "default",
        category: "none",
        originalCodes: [],
        sort_order: 0,
        isDefault: true,
        defaultIdx: i,
      });
    });

    // Sort: rows with explicit sort_order > 0 by that value, defaults by their
    // natural index, ties broken by label.
    rows.sort((a, b) => {
      const aHas = a.sort_order > 0;
      const bHas = b.sort_order > 0;
      if (aHas && bHas) return a.sort_order - b.sort_order;
      if (aHas) return -1;
      if (bHas) return 1;
      // both unsorted: defaults by their natural order, then customs
      if (a.isDefault && b.isDefault) return a.defaultIdx - b.defaultIdx;
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return a.custom_label.localeCompare(b.custom_label, "ar");
    });

    setMappings(rows.map(({ codes, custom_label, color, category, originalCodes }) => ({
      codes, custom_label, color, category, originalCodes,
    })));
  };

  useEffect(() => { loadMappings(); }, []);

  const updateMapping = (idx: number, field: "codes" | "custom_label" | "color" | "category", value: string) => {
    setMappings((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  };

  const addMapping = () => {
    setMappings((prev) => [...prev, { codes: "", custom_label: "", color: "default", category: "none", originalCodes: [] }]);
  };

  const removeMapping = async (idx: number) => {
    const m = mappings[idx];
    if (m.originalCodes.length > 0) {
      await supabase
        .from("carrier_status_mappings")
        .delete()
        .in("status_code", m.originalCodes);
    }
    // If any of the codes are default codes, remember the deletion so they don't reappear.
    const codesInRow = parseCodes(m.codes).concat(m.originalCodes);
    const defaultsToHide = Array.from(new Set(codesInRow)).filter((c) =>
      DEFAULT_CODES.some((d) => d.code === c),
    );
    if (defaultsToHide.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("hidden_default_carrier_codes")
          .upsert(
            defaultsToHide.map((status_code) => ({ owner_id: user.id, status_code })),
            { onConflict: "owner_id,status_code" },
          );
      }
    }
    setMappings((prev) => prev.filter((_, i) => i !== idx));
    toast({ title: "تم الحذف" });
  };

  const parseCodes = (raw: string): string[] => {
    return Array.from(
      new Set(
        raw
          .split(/[,،\s]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
  };

  const saveMappings = async () => {
    setSavingMappings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("يجب تسجيل الدخول");

      // Build expanded rows (one per code) and detect codes that were removed
      // from a row so we can delete their old DB entries.
      const rows: Array<{ owner_id: string; status_code: string; custom_label: string; color: string; category: string | null; sort_order: number }> = [];
      const codesToDelete: string[] = [];
      mappings.forEach((m, idx) => {
        const label = m.custom_label.trim();
        const newCodes = parseCodes(m.codes);
        if (!label || newCodes.length === 0) {
          // Whole row is empty — drop any previously saved codes
          codesToDelete.push(...m.originalCodes);
          return;
        }
        const newSet = new Set(newCodes);
        for (const oc of m.originalCodes) {
          if (!newSet.has(oc)) codesToDelete.push(oc);
        }
        for (const c of newCodes) {
          rows.push({
            owner_id: user.id,
            status_code: c,
            custom_label: label,
            color: m.color || "default",
            category: m.category && m.category !== "none" ? m.category : null,
            sort_order: (idx + 1) * 10,
          });
        }
      });

      if (codesToDelete.length > 0) {
        await supabase
          .from("carrier_status_mappings")
          .delete()
          .eq("owner_id", user.id)
          .in("status_code", codesToDelete);
      }
      if (rows.length > 0) {
        const { error } = await supabase
          .from("carrier_status_mappings")
          .upsert(rows, { onConflict: "owner_id,status_code" });
        if (error) throw error;
      }
      toast({ title: "تم الحفظ", description: "تم حفظ تخصيص أسماء الحالات" });
      await loadMappings();
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingMappings(false);
    }
  };

  const loadCount = async () => {
    if (!activeStoreId) {
      setWhCount(0);
      return;
    }
    const { count } = await supabase
      .from("shipping_warehouse_products")
      .select("*", { count: "exact", head: true })
      .eq("store_id", activeStoreId);
    setWhCount(count || 0);
  };
  useEffect(() => {
    loadCount();
    setShowCompare(false);
    setWhProducts([]);
  }, [activeStoreId]);

  const loadComparison = async () => {
    if (!activeStoreId) {
      toast({ title: "اختر متجراً", description: "يجب اختيار متجر قبل عرض منتجات المخزن", variant: "destructive" });
      return;
    }
    setCompareLoading(true);
    try {
      const [{ data: wh }, { data: prods }] = await Promise.all([
        supabase
          .from("shipping_warehouse_products")
          .select("external_id, code, name, stock, synced_at")
          .eq("store_id", activeStoreId)
          .order("name"),
        supabase
          .from("products")
          .select("id, name, variant_warehouse_codes, variant_stock, stock")
          .eq("store_id", activeStoreId),
      ]);
      setWhProducts((wh || []) as any);
      setLocalProducts((prods || []) as any);
      const map = new Map<string, Array<{ productName: string; variantKey: string; localStock: number }>>();
      for (const p of (prods || []) as any[]) {
        const codes = (p.variant_warehouse_codes || {}) as Record<string, any>;
        const stocks = (p.variant_stock || {}) as Record<string, number>;
        const entries = Object.entries(codes);
        if (entries.length === 0) continue;
        for (const [variantKey, extId] of entries) {
          const key = String(extId).trim();
          if (!key) continue;
          const arr = map.get(key) || [];
          arr.push({
            productName: p.name,
            variantKey: variantKey || "—",
            localStock: Number(stocks?.[variantKey] ?? p.stock ?? 0),
          });
          map.set(key, arr);
        }
      }
      setLinkedMap(map);
      setShowCompare(true);
    } finally {
      setCompareLoading(false);
    }
  };

  const handleApplyMatch = async () => {
    if (!confirm("سيتم استبدال كميات منتجاتك المرتبطة بالكميات الحالية في شركة الشحن. هل تريد المتابعة؟")) return;
    setApplying(true);
    try {
      const stockByExtId = new Map<string, number>();
      for (const w of whProducts) stockByExtId.set(String(w.external_id), Number(w.stock || 0));

      let updatedProducts = 0;
      let updatedVariants = 0;
      for (const p of localProducts) {
        const codes = (p.variant_warehouse_codes || {}) as Record<string, any>;
        const entries = Object.entries(codes).filter(([, v]) => String(v ?? "").trim() !== "");
        if (entries.length === 0) continue;
        const newVariantStock: Record<string, number> = { ...(p.variant_stock || {}) };
        let changed = false;
        for (const [variantKey, extId] of entries) {
          const wstock = stockByExtId.get(String(extId).trim());
          if (wstock == null) continue;
          if (Number(newVariantStock[variantKey] ?? -1) !== wstock) {
            newVariantStock[variantKey] = wstock;
            changed = true;
            updatedVariants++;
          }
        }
        if (!changed) continue;
        const total = Object.values(newVariantStock).reduce((a, b) => a + (Number(b) || 0), 0);
        const { error } = await supabase
          .from("products")
          .update({ variant_stock: newVariantStock, stock: total })
          .eq("id", p.id);
        if (!error) updatedProducts++;
      }
      toast({
        title: "تمت المطابقة",
        description: `تم تحديث ${updatedVariants} متغير في ${updatedProducts} منتج`,
      });
      await loadComparison();
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("webhook_token")
        .eq("user_id", user.id)
        .maybeSingle();
      const token = (data as any)?.webhook_token;
      if (token) {
        const base = import.meta.env.VITE_SUPABASE_URL;
        setWebhookUrl(`${base}/functions/v1/carrier-webhook?token=${token}`);
      }
    })();
  }, []);

  const handleSyncProducts = async () => {
    if (!activeStoreId) {
      toast({ title: "اختر متجراً", description: "يجب اختيار متجر قبل مزامنة منتجات المخزن", variant: "destructive" });
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-warehouse-products", {
        body: { store_id: activeStoreId },
      });
      if (error) throw new Error(await getEdgeFunctionErrorMessage(error, data));
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "تمت المزامنة", description: `تم جلب ${(data as any)?.count ?? 0} منتج من مخزن الشركة` });
      await loadCount();
      await loadComparison();
    } catch (e) {
      toast({ title: "خطأ", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!activeStoreId) { setSettings(DEFAULT); setLoading(false); return; }
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("shipping_settings")
        .select("*")
        .eq("store_id", activeStoreId)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const row = data[0] as ShippingSettings;
        setSettings({
          ...DEFAULT,
          ...row,
          auto_mark_delivered: row.auto_mark_delivered !== false,
        });
      } else setSettings(DEFAULT);
      setLoading(false);
    })();
  }, [activeStoreId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("shipping_endpoint")
        .limit(1)
        .maybeSingle();
      if ((data as any)?.shipping_endpoint) setGlobalEndpoint((data as any).shipping_endpoint);
    })();
  }, []);

  const saveGlobalEndpoint = async () => {
    setSavingEndpoint(true);
    const { data: existing } = await supabase.from("app_settings").select("id").limit(1).maybeSingle();
    const { error } = existing
      ? await supabase.from("app_settings").update({ shipping_endpoint: globalEndpoint.trim() } as any).eq("id", (existing as any).id)
      : await supabase.from("app_settings").insert({ shipping_endpoint: globalEndpoint.trim() } as any);
    setSavingEndpoint(false);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else toast({ title: "تم الحفظ", description: "تم حفظ رابط API الشحن العام" });
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      email: settings.email.trim(),
      password: settings.password,
      endpoint: settings.endpoint.trim(),
      enabled: settings.enabled,
      auto_mark_delivered: settings.auto_mark_delivered,
    };
    const { error } = settings.id
      ? await supabase.from("shipping_settings").update(payload).eq("id", settings.id)
      : await supabase.from("shipping_settings").insert({ ...payload, owner_id: user!.id, store_id: activeStoreId }).select().single().then(r => {
          if (r.data) setSettings(r.data as ShippingSettings);
          return { error: r.error };
        });
    setSaving(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحفظ", description: "تم حفظ إعدادات شركة الشحن" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white flex items-center justify-center shadow-md shrink-0">
          <Truck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">إعدادات شركة الشحن</h1>
          <p className="text-sm text-muted-foreground">Accurate / Turbo Express</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>بيانات تسجيل الدخول</CardTitle>
          <CardDescription>
            أدخل البريد الإلكتروني وكلمة المرور الخاصين بحسابك في شركة الشحن.
            تُستخدم هذه البيانات لإرسال الطلبيات تلقائياً عبر API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="font-medium">تفعيل التكامل</Label>
              <p className="text-xs text-muted-foreground">عند التفعيل يظهر زر الإرسال في صفحة الطلبيات</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="font-medium">تحديث «تم الاستلام» تلقائياً</Label>
              <p className="text-xs text-muted-foreground">
                عند وصول أكواد DTR من شركة الشحن (تم التسليم)، يُحدَّث حالة الطلب إلى «تم الاستلام» تلقائياً
              </p>
            </div>
            <Switch
              checked={settings.auto_mark_delivered}
              onCheckedChange={(v) => setSettings({ ...settings, auto_mark_delivered: v })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              placeholder="example@company.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              value={settings.password}
              onChange={(e) => setSettings({ ...settings, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>

          {isAdmin && (
            <div className="space-y-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
              <Label htmlFor="endpoint" className="font-bold">رابط الـ API (عام لجميع المتاجر)</Label>
              <p className="text-xs text-muted-foreground">يُدار من السوبر ادمن فقط ويُطبَّق على جميع المتاجر تلقائياً.</p>
              <div className="flex gap-2">
                <Input
                  id="endpoint"
                  dir="ltr"
                  value={globalEndpoint}
                  onChange={(e) => setGlobalEndpoint(e.target.value)}
                />
                <Button type="button" onClick={saveGlobalEndpoint} disabled={savingEndpoint} variant="secondary">
                  {savingEndpoint && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  حفظ الرابط
                </Button>
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            حفظ الإعدادات
          </Button>

          <div className="border-t pt-4 space-y-2">
            <Label>منتجات مخزن شركة الشحن</Label>
            <p className="text-sm text-muted-foreground">
              المنتجات المتزامنة حالياً: <span className="font-bold">{whCount}</span>
            </p>
            <Button onClick={handleSyncProducts} disabled={syncing || !settings.enabled} variant="secondary" className="w-full">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <RefreshCw className="w-4 h-4 ml-2" />}
              مزامنة منتجات المخزن من شركة الشحن
            </Button>
            <Button onClick={loadComparison} disabled={compareLoading} variant="outline" className="w-full">
              {compareLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Package className="w-4 h-4 ml-2" />}
              {showCompare ? "تحديث المقارنة" : "عرض مقارنة الكميات"}
            </Button>
            {showCompare && (
              <Button onClick={handleApplyMatch} disabled={applying} className="w-full">
                {applying ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <CheckCircle2 className="w-4 h-4 ml-2" />}
                مطابقة الكميات (نسخ الكميات من شركة الشحن إلى منتجاتنا)
              </Button>
            )}
            {showCompare && (
              <div className="border rounded-md mt-2 max-h-[480px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="text-right">
                      <th className="p-2 font-medium">منتج المخزن (شركة الشحن)</th>
                      <th className="p-2 font-medium">الكود</th>
                      <th className="p-2 font-medium text-center">الكمية في الشركة</th>
                      <th className="p-2 font-medium">المنتج المرتبط عندنا</th>
                      <th className="p-2 font-medium text-center">الكمية عندنا</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whProducts.length === 0 && (
                      <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">لا توجد منتجات مزامنة بعد</td></tr>
                    )}
                    {whProducts.map((w) => {
                      const links = linkedMap.get(String(w.external_id)) || [];
                      const rowSpan = Math.max(1, links.length);
                      if (links.length === 0) {
                        return (
                          <tr key={w.external_id} className="border-t">
                            <td className="p-2">{w.name || `#${w.external_id}`}</td>
                            <td className="p-2 font-mono text-xs">{w.code || "—"}</td>
                            <td className="p-2 text-center font-bold">{w.stock}</td>
                            <td className="p-2 text-muted-foreground">
                              <span className="inline-flex items-center gap-1 text-amber-600">
                                <AlertCircle className="w-3 h-3" /> غير مرتبط
                              </span>
                            </td>
                            <td className="p-2 text-center text-muted-foreground">—</td>
                          </tr>
                        );
                      }
                      return links.map((lnk, i) => (
                        <tr key={`${w.external_id}-${i}`} className="border-t">
                          {i === 0 && (
                            <>
                              <td className="p-2 align-top" rowSpan={rowSpan}>{w.name || `#${w.external_id}`}</td>
                              <td className="p-2 font-mono text-xs align-top" rowSpan={rowSpan}>{w.code || "—"}</td>
                              <td className="p-2 text-center font-bold align-top" rowSpan={rowSpan}>{w.stock}</td>
                            </>
                          )}
                          <td className="p-2">
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" />
                            </span>
                            {lnk.productName}
                            {lnk.variantKey && lnk.variantKey !== "—" && (
                              <span className="text-xs text-muted-foreground"> — {lnk.variantKey}</span>
                            )}
                          </td>
                          <td className="p-2 text-center">{lnk.localStock}</td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label>رابط الويب هوك لتحديث حالات الشحنات</Label>
            <p className="text-xs text-muted-foreground">
              أرسل هذا الرابط لشركة الشحن (Turbo) ليُرسلوا تحديثات حالة الشحنة عليه. سيتم تحديث "حالة شركة التوصيل" تلقائياً في الطلبات بناءً على كود الشحن.
            </p>
            <div className="flex gap-2">
              <Input dir="ltr" readOnly value={webhookUrl} placeholder="جاري التحميل..." />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (!webhookUrl) return;
                  navigator.clipboard.writeText(webhookUrl);
                  toast({ title: "تم النسخ" });
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {isAdmin && (
          <div className="border-t pt-4 space-y-3">
            <div>
              <Label className="text-base font-bold">تخصيص أسماء حالات الشحن</Label>
              <p className="text-xs text-muted-foreground mt-1">
                حوّل أكواد الحالات القادمة من شركة الشحن إلى أسماء تفهمها. يمكنك إضافة أكثر من كود لنفس الاسم بفصلهم بفاصلة (مثال: <span className="font-mono">RTS, RTSWODF, RTSD</span> ← "راجع").
              </p>
            </div>

            <p className="text-xs text-muted-foreground -mt-1">
              اسحب وأفلت الصفوف لإعادة ترتيب عرض الحالات في الفلتر.
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-[24px_160px_1fr_120px_140px_40px] gap-2 text-xs font-bold text-muted-foreground px-1">
                <span></span>
                <span>الأكواد (افصل بفاصلة)</span>
                <span>الاسم المعروض</span>
                <span>اللون</span>
                <span>تصنيف نسبة التسليم</span>
                <span></span>
              </div>
              {mappings.map((m, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={(e) => {
                    setDragIdx(idx);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverIdx !== idx) setDragOverIdx(idx);
                  }}
                  onDragLeave={() => {
                    if (dragOverIdx === idx) setDragOverIdx(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIdx === null || dragIdx === idx) {
                      setDragIdx(null);
                      setDragOverIdx(null);
                      return;
                    }
                    setMappings((prev) => {
                      const next = [...prev];
                      const [moved] = next.splice(dragIdx, 1);
                      next.splice(idx, 0, moved);
                      return next;
                    });
                    setDragIdx(null);
                    setDragOverIdx(null);
                  }}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setDragOverIdx(null);
                  }}
                  className={`grid grid-cols-[24px_160px_1fr_120px_140px_40px] gap-2 items-center rounded-md transition-colors ${
                    dragOverIdx === idx && dragIdx !== null && dragIdx !== idx ? "bg-accent/40" : ""
                  } ${dragIdx === idx ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <Input
                    dir="ltr"
                    value={m.codes}
                    onChange={(e) => updateMapping(idx, "codes", e.target.value)}
                    placeholder="RTS, RTSWODF"
                    className="font-mono text-center"
                  />
                  <Input
                    value={m.custom_label}
                    onChange={(e) => updateMapping(idx, "custom_label", e.target.value)}
                    placeholder="مثال: تم التوصيل"
                  />
                  <select
                    value={m.color || "default"}
                    onChange={(e) => updateMapping(idx, "color", e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {COLOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <select
                    value={m.category || "none"}
                    onChange={(e) => updateMapping(idx, "category", e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMapping(idx)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={addMapping} className="flex-1">
                <Plus className="w-4 h-4 ml-2" />
                إضافة حالة جديدة
              </Button>
              <Button type="button" onClick={saveMappings} disabled={savingMappings} className="flex-1">
                {savingMappings && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                حفظ التخصيصات
              </Button>
            </div>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShippingSettingsPage;
