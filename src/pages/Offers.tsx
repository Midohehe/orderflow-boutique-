import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3, Copy, Download, GitBranch, Loader2, Plus, Sparkles, Trash2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useStoreContext } from "@/hooks/useStoreContext";
import { useUserContext } from "@/hooks/useUserContext";
import {
  deleteFlow,
  deleteOffer,
  duplicateOffer,
  exportOffersCsv,
  listFlows,
  listOffers,
  saveFlow,
} from "@/lib/offers/api";
import { OFFER_TYPE_META, type OfferFlow, type OfferRecord } from "@/lib/offers/types";
import { OfferFlowCanvas } from "@/components/offers/OfferFlowCanvas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusLabel: Record<string, string> = {
  active: "نشط",
  draft: "مسودة",
  disabled: "معطّل",
};

const statusClass: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700",
  draft: "bg-amber-500/15 text-amber-700",
  disabled: "bg-slate-500/15 text-slate-600",
};

export default function Offers() {
  const navigate = useNavigate();
  const { activeStoreId } = useStoreContext();
  const { effectiveOwnerId } = useUserContext();
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [flows, setFlows] = useState<OfferFlow[]>([]);
  const [q, setQ] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeFlow, setActiveFlow] = useState<OfferFlow | null>(null);
  const [savingFlow, setSavingFlow] = useState(false);

  const load = async () => {
    if (!activeStoreId) return;
    setLoading(true);
    try {
      const [o, f] = await Promise.all([listOffers(activeStoreId), listFlows(activeStoreId)]);
      setOffers(o);
      setFlows(f);
      if (!activeFlow && f[0]) setActiveFlow(f[0]);
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "تعذر تحميل العروض", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStoreId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return offers;
    return offers.filter(
      (o) =>
        o.name.toLowerCase().includes(s) ||
        o.offer_type.includes(s) ||
        OFFER_TYPE_META[o.offer_type].label.toLowerCase().includes(s),
    );
  }, [offers, q]);

  const totals = useMemo(() => {
    return offers.reduce(
      (acc, o) => {
        acc.views += o.stats?.views || 0;
        acc.accepts += o.stats?.accepts || 0;
        acc.revenue += o.stats?.revenue || 0;
        return acc;
      },
      { views: 0, accepts: 0, revenue: 0 },
    );
  }, [offers]);

  const handleDuplicate = async (id: string) => {
    try {
      const newId = await duplicateOffer(id);
      toast({ title: "تم النسخ" });
      await load();
      navigate(`/dashboard/offers/${newId}/edit`);
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteOffer(deleteId);
      setDeleteId(null);
      toast({ title: "تم الحذف" });
      await load();
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message, variant: "destructive" });
    }
  };

  const exportCsv = () => {
    const csv = exportOffersCsv(filtered);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `offers-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createFlow = async () => {
    if (!effectiveOwnerId || !activeStoreId) return;
    try {
      const id = await saveFlow({
        ownerId: effectiveOwnerId,
        storeId: activeStoreId,
        name: `مسار ${flows.length + 1}`,
        is_active: true,
        graph: {
          nodes: [
            { id: "landing", type: "landing", label: "صفحة الهبوط", x: 40, y: 80 },
            { id: "checkout", type: "checkout", label: "الدفع", x: 220, y: 80 },
            { id: "thank_you", type: "thank_you", label: "صفحة الشكر", x: 400, y: 80 },
          ],
          edges: [
            { id: "e1", from: "landing", to: "checkout" },
            { id: "e2", from: "checkout", to: "thank_you" },
          ],
        },
      });
      await load();
      const list = await listFlows(activeStoreId);
      setActiveFlow(list.find((f) => f.id === id) || null);
      toast({ title: "تم إنشاء المسار" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message, variant: "destructive" });
    }
  };

  const persistFlow = async () => {
    if (!activeFlow || !effectiveOwnerId || !activeStoreId) return;
    setSavingFlow(true);
    try {
      await saveFlow({
        id: activeFlow.id,
        ownerId: effectiveOwnerId,
        storeId: activeStoreId,
        name: activeFlow.name,
        is_active: activeFlow.is_active,
        graph: activeFlow.graph,
      });
      toast({ title: "تم حفظ المسار" });
      await load();
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message, variant: "destructive" });
    } finally {
      setSavingFlow(false);
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
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Sparkles}
        title="منشئ العروض"
        description="Upsell · Cross Sell · Post Purchase · Order Bump — من مكان واحد"
        iconGradient="from-emerald-500 to-teal-600"
      />

      <div className="grid sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">المشاهدات</div>
            <div className="text-2xl font-bold">{totals.views}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">القبولات</div>
            <div className="text-2xl font-bold">{totals.accepts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">إيرادات العروض</div>
            <div className="text-2xl font-bold">{totals.revenue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="offers">
        <TabsList>
          <TabsTrigger value="offers" className="gap-2">
            <Sparkles className="w-4 h-4" />
            العروض ({offers.length})
          </TabsTrigger>
          <TabsTrigger value="flows" className="gap-2">
            <GitBranch className="w-4 h-4" />
            مسار العروض
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            التحليلات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="offers" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالاسم أو النوع…"
              className="sm:max-w-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={exportCsv} className="gap-2">
                <Download className="w-4 h-4" />
                تصدير CSV
              </Button>
              <Button asChild className="gap-2">
                <Link to="/dashboard/offers/new">
                  <Plus className="w-4 h-4" />
                  إنشاء عرض
                </Link>
              </Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center space-y-3">
                <Sparkles className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="font-semibold">لا توجد عروض بعد</p>
                <p className="text-sm text-muted-foreground">أنشئ أول عرض في دقائق من القوالب الجاهزة</p>
                <Button asChild>
                  <Link to="/dashboard/offers/new">ابدأ الآن</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filtered.map((o) => {
                const meta = OFFER_TYPE_META[o.offer_type];
                const rate = o.stats?.acceptance_rate ?? 0;
                return (
                  <Card key={o.id} className="overflow-hidden">
                    <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-lg truncate">{o.name}</h3>
                          <Badge className={statusClass[o.status]}>{statusLabel[o.status]}</Badge>
                          <Badge variant="outline">{meta.label}</Badge>
                          <Badge variant="secondary">أولوية {o.priority}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{meta.description}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>👁 {o.stats?.views ?? 0}</span>
                          <span>✓ {o.stats?.accepts ?? 0}</span>
                          <span>✗ {o.stats?.rejects ?? 0}</span>
                          <span>نسبة القبول {rate}%</span>
                          <span>إيراد {(o.stats?.revenue ?? 0).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/dashboard/offers/${o.id}/edit`}>
                            <Pencil className="w-4 h-4 ml-1" />
                            تعديل
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDuplicate(o.id)}>
                          <Copy className="w-4 h-4 ml-1" />
                          نسخ
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteId(o.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="flows" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm sm:max-w-xs"
              value={activeFlow?.id || ""}
              onChange={(e) => setActiveFlow(flows.find((f) => f.id === e.target.value) || null)}
            >
              <option value="">— اختر مساراً —</option>
              {flows.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={createFlow}>مسار جديد</Button>
              <Button type="button" onClick={persistFlow} disabled={!activeFlow || savingFlow}>
                {savingFlow ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ المسار"}
              </Button>
              {activeFlow && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    await deleteFlow(activeFlow.id);
                    setActiveFlow(null);
                    await load();
                  }}
                >
                  حذف
                </Button>
              )}
            </div>
          </div>

          {activeFlow ? (
            <div className="space-y-3">
              <Input
                value={activeFlow.name}
                onChange={(e) => setActiveFlow({ ...activeFlow, name: e.target.value })}
                placeholder="اسم المسار"
              />
              <OfferFlowCanvas
                nodes={activeFlow.graph.nodes || []}
                edges={activeFlow.graph.edges || []}
                offers={offers}
                onChange={(nodes, edges) =>
                  setActiveFlow({ ...activeFlow, graph: { nodes, edges } })
                }
              />
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <GitBranch className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">أنشئ مساراً لربط العروض برحلة الزبون</p>
                <Button onClick={createFlow}>إنشاء مسار</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-right py-2 font-medium">العرض</th>
                    <th className="text-right py-2 font-medium">مشاهدات</th>
                    <th className="text-right py-2 font-medium">نقرات</th>
                    <th className="text-right py-2 font-medium">قبول</th>
                    <th className="text-right py-2 font-medium">رفض</th>
                    <th className="text-right py-2 font-medium">نسبة القبول</th>
                    <th className="text-right py-2 font-medium">إيراد</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{o.name}</td>
                      <td className="py-2">{o.stats?.views ?? 0}</td>
                      <td className="py-2">{o.stats?.clicks ?? 0}</td>
                      <td className="py-2">{o.stats?.accepts ?? 0}</td>
                      <td className="py-2">{o.stats?.rejects ?? 0}</td>
                      <td className="py-2">{o.stats?.acceptance_rate ?? 0}%</td>
                      <td className="py-2">{(o.stats?.revenue ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {offers.length === 0 && (
                <p className="text-center text-muted-foreground py-8">لا توجد بيانات بعد</p>
              )}
            </CardContent>
          </Card>
          <Button type="button" variant="outline" onClick={exportCsv} className="gap-2">
            <Download className="w-4 h-4" />
            تصدير Excel/CSV
          </Button>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العرض؟</AlertDialogTitle>
            <AlertDialogDescription>لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
