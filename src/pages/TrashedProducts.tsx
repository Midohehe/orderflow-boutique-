import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, RotateCcw, Trash2, Package, Loader2 } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { isolateLatin } from "@/lib/bidi";

interface TrashedProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  images: string[];
  deleted_at: string;
}

const TrashedProducts = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: userLoading } = useUserContext();
  const [products, setProducts] = useState<TrashedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<TrashedProduct | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      let q = supabase
        .from("products")
        .select("id, name, slug, price, images, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (!isAdmin) q = q.eq("owner_id", user.id);
      const { data, error } = await q;
      if (error) throw error;
      setProducts((data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: String(p.price),
        images: p.images || [],
        deleted_at: p.deleted_at,
      })));
    } catch (e) {
      console.error(e);
      toast({ title: "خطأ", description: "تعذر تحميل سلة المحذوفات", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (!userLoading) load(); }, [userLoading, isAdmin]);

  const restore = async (p: TrashedProduct) => {
    setBusyId(p.id);
    try {
      const { error } = await supabase
        .from("products")
        .update({ deleted_at: null })
        .eq("id", p.id);
      if (error) throw error;
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
      toast({ title: "تم الاستعادة", description: "تم استعادة المنتج بنجاح" });
    } catch (e) {
      console.error(e);
      toast({ title: "خطأ", description: "تعذر استعادة المنتج", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const purge = async () => {
    if (!purgeTarget) return;
    setBusyId(purgeTarget.id);
    try {
      const { error } = await supabase.from("products").delete().eq("id", purgeTarget.id);
      if (error) throw error;
      setProducts((prev) => prev.filter((x) => x.id !== purgeTarget.id));
      toast({ title: "تم الحذف نهائياً", description: "تم حذف المنتج بشكل نهائي" });
      setPurgeTarget(null);
    } catch (e) {
      console.error(e);
      toast({ title: "خطأ", description: "تعذر حذف المنتج نهائياً", variant: "destructive" });
    } finally {
      setBusyId(null);
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
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">سلة المحذوفات</h1>
          <p className="text-sm text-muted-foreground">المنتجات المحذوفة — يمكنك استعادتها أو حذفها نهائياً</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate("/dashboard/products")}>
          <ArrowRight className="w-4 h-4" />
          العودة للمنتجات
        </Button>
      </div>

      {products.length === 0 ? (
        <Card className="card-shadow">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trash2 className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">سلة المحذوفات فارغة</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="card-shadow overflow-hidden opacity-80">
              <div className="aspect-video relative overflow-hidden bg-muted">
                {product.images[0] ? (
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-10 h-10 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-foreground">{isolateLatin(product.name)}</h3>
                  <span className="text-primary font-bold">{product.price}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  حُذف في: {new Date(product.deleted_at).toLocaleString("ar")}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-2 bg-green-500 hover:bg-green-600 text-white"
                    onClick={() => restore(product)}
                    disabled={busyId === product.id}
                  >
                    <RotateCcw className="w-4 h-4" />
                    استعادة
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-2"
                    onClick={() => setPurgeTarget(product)}
                    disabled={busyId === product.id}
                  >
                    <Trash2 className="w-4 h-4" />
                    حذف نهائي
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!purgeTarget} onOpenChange={(open) => !open && setPurgeTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف نهائي</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المنتج «{purgeTarget?.name}» بشكل نهائي ولا يمكن استرجاعه. هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); purge(); }} className="bg-red-500 hover:bg-red-600 text-white">
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TrashedProducts;
