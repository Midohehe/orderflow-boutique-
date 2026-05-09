import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Search } from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface EoVariant {
  id?: string;
  name?: string | null;
  sku?: string | null;
  price?: number | null;
  stock?: number | null;
  props?: Array<{ variation_name?: string; variation_prop?: string }> | null;
  [k: string]: any;
}

interface EoProduct {
  id: string;
  external_id: string;
  name: string | null;
  sku: string | null;
  variants: EoVariant[];
  raw: any;
  synced_at: string;
}

const EasyOrdersProducts = () => {
  const [products, setProducts] = useState<EoProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("easyorders_products")
        .select("id, external_id, name, sku, variants, raw, synced_at")
        .order("name", { ascending: true });
      if (!error && data) setProducts(data as any);
      setLoading(false);
    })();
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? products.filter((p) => {
        const hay = [
          p.name || "",
          p.sku || "",
          p.external_id,
          ...(Array.isArray(p.variants)
            ? p.variants.flatMap((v) => [v.name || "", v.sku || ""])
            : []),
        ].join(" ").toLowerCase();
        return hay.includes(q);
      })
    : products;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">منتجات ايزي اوردرز</h1>
          <p className="text-sm text-muted-foreground">
            عرض المنتجات والمتغيرات المجلوبة من EasyOrders
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ابحث بالاسم أو SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {products.length === 0
                ? 'لا توجد منتجات. اذهب إلى "حسابي" واضغط "مزامنة منتجات EasyOrders".'
                : "لا توجد نتائج مطابقة."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              عدد المنتجات: {filtered.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {filtered.map((p) => {
                const variants = Array.isArray(p.variants) ? p.variants : [];
                return (
                  <AccordionItem key={p.id} value={p.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-1 flex-wrap items-center gap-2 text-right">
                        <span className="font-semibold">{p.name || `#${p.external_id}`}</span>
                        {p.sku && (
                          <Badge variant="outline" className="font-mono text-xs">
                            SKU: {p.sku}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {variants.length} متغير
                        </Badge>
                        <span className="text-xs text-muted-foreground ms-auto">
                          ID: {p.external_id}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {variants.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">الاسم</TableHead>
                                <TableHead className="text-right">SKU</TableHead>
                                <TableHead className="text-right">الخصائص</TableHead>
                                <TableHead className="text-right">السعر</TableHead>
                                <TableHead className="text-right">المخزون</TableHead>
                                <TableHead className="text-right">المعرّف</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {variants.map((v, i) => (
                                <TableRow key={v.id || i}>
                                  <TableCell>{v.name || "—"}</TableCell>
                                  <TableCell className="font-mono text-xs">{v.sku || "—"}</TableCell>
                                  <TableCell>
                                    {Array.isArray(v.props) && v.props.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {v.props.map((pr, idx) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            {pr.variation_name}: {pr.variation_prop}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell>{v.price ?? "—"}</TableCell>
                                  <TableCell>{v.stock ?? "—"}</TableCell>
                                  <TableCell className="font-mono text-xs text-muted-foreground">
                                    {v.id || "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">لا توجد متغيرات.</p>
                      )}

                      <div className="mt-4 text-xs text-muted-foreground">
                        آخر مزامنة: {new Date(p.synced_at).toLocaleString("ar-EG")}
                      </div>

                      {p.raw && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            عرض البيانات الخام (JSON)
                          </summary>
                          <pre className="mt-2 max-h-96 overflow-auto rounded bg-muted p-3 text-[11px] leading-relaxed">
                            {JSON.stringify(p.raw, null, 2)}
                          </pre>
                        </details>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EasyOrdersProducts;