import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Store, ExternalLink, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface StoreRow {
  user_id: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
  productCount: number;
  orderCount: number;
}

const AdminStores = () => {
  const { isAdmin, loading: ctxLoading } = useUserContext();
  const navigate = useNavigate();
  const [rows, setRows] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ctxLoading) return;
    if (!isAdmin) { setLoading(false); return; }
    (async () => {
      try {
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("user_id, username, full_name, is_active")
          .order("created_at", { ascending: false });
        if (error) throw error;

        const ids = (profiles || []).map((p: any) => p.user_id);
        const [prodRes, ordRes] = await Promise.all([
          supabase.from("products").select("owner_id").is("deleted_at", null).in("owner_id", ids),
          supabase.from("orders").select("owner_id").in("owner_id", ids),
        ]);
        const pCount: Record<string, number> = {};
        (prodRes.data || []).forEach((r: any) => { pCount[r.owner_id] = (pCount[r.owner_id] || 0) + 1; });
        const oCount: Record<string, number> = {};
        (ordRes.data || []).forEach((r: any) => { oCount[r.owner_id] = (oCount[r.owner_id] || 0) + 1; });

        setRows((profiles || []).map((p: any) => ({
          user_id: p.user_id,
          username: p.username,
          full_name: p.full_name,
          is_active: p.is_active,
          productCount: pCount[p.user_id] || 0,
          orderCount: oCount[p.user_id] || 0,
        })));
      } catch (e) {
        console.error(e);
        toast({ title: "خطأ", description: "تعذر تحميل قائمة المتاجر", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin, ctxLoading]);

  if (ctxLoading || loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) {
    return <div className="p-6 text-center text-muted-foreground">هذا القسم مخصص للأدمن فقط.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">المتاجر</h1>
        <p className="text-sm text-muted-foreground">قائمة بجميع المتاجر — اختر متجراً لعرض بياناته</p>
      </div>

      {rows.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Store className="w-16 h-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">لا توجد متاجر</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((s) => (
            <Card key={s.user_id} className="card-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{s.full_name || s.username}</h3>
                    <p className="text-xs text-muted-foreground" dir="ltr">@{s.username}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${s.is_active ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
                    {s.is_active ? "نشط" : "موقوف"}
                  </span>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>المنتجات: <strong className="text-foreground">{s.productCount}</strong></span>
                  <span>الطلبيات: <strong className="text-foreground">{s.orderCount}</strong></span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 gap-2" onClick={() => navigate(`/dashboard/stores/${s.user_id}`)}>
                    <Eye className="w-4 h-4" /> عرض البيانات
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => window.open(`/store/${s.username}`, "_blank")}>
                    <ExternalLink className="w-4 h-4" /> المتجر
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminStores;
