import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, DollarSign, CheckCircle, Filter, Boxes, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
import { isolateLatin } from "@/lib/bidi";
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Order {
  id: string;
  product_name: string;
  price: number;
  status: string;
  customer_name: string;
  created_at: string;
}

interface ProductRow {
  id: string;
  name: string;
  price: number;
  purchase_price: number;
  stock: number;
  variant_stock: Record<string, number> | null;
  colors: string[] | null;
  sizes: string[] | null;
  product_codes: string[] | null;
}

const FinancialAccounts = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [productsList, setProductsList] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [savingStock, setSavingStock] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const productsQuery = user
        ? supabase.from("products").select("id, name, price, purchase_price, stock, variant_stock, colors, sizes, product_codes").eq("owner_id", user.id).order("created_at", { ascending: false })
        : supabase.from("products").select("id, name, price, purchase_price, stock, variant_stock, colors, sizes, product_codes").order("created_at", { ascending: false });

      const [ordersRes, productsRes] = await Promise.all([
        supabase.from("orders").select("id, product_name, price, status, customer_name, created_at").order("created_at", { ascending: false }),
        productsQuery,
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (productsRes.error) throw productsRes.error;

      setOrders(ordersRes.data || []);
      setProductsList((productsRes.data as ProductRow[]) || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل البيانات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Build variant keys for a product
  const getVariantKeys = (prod: ProductRow): string[] => {
    const colors = (prod.colors || []).filter(Boolean);
    const sizes = (prod.sizes || []).filter(Boolean);
    const codes = (prod.product_codes || []).filter(Boolean);
    const keys: string[] = [];
    if (colors.length && sizes.length) {
      colors.forEach((c) => sizes.forEach((s) => keys.push(`${c} - ${s}`)));
    } else if (colors.length) {
      keys.push(...colors);
    } else if (sizes.length) {
      keys.push(...sizes);
    }
    codes.forEach((c) => {
      if (!keys.includes(c)) keys.push(c);
    });
    return keys;
  };

  const handleSaveProductStock = async (prod: ProductRow) => {
    const variantKeys = getVariantKeys(prod);
    setSavingStock(prod.id);
    try {
      const updatePayload: { purchase_price?: number; stock?: number; variant_stock?: Record<string, number> } = {};
      let newPurchase = prod.purchase_price;
      const priceRaw = priceEdits[`price__${prod.id}`];
      if (priceRaw !== undefined) {
        const parsed = parseFloat(priceRaw);
        if (isNaN(parsed) || parsed < 0) {
          toast({ title: "خطأ", description: "سعر شراء غير صالح", variant: "destructive" });
          setSavingStock(null);
          return;
        }
        newPurchase = parsed;
        updatePayload.purchase_price = parsed;
      }

      let newStockTotal = prod.stock;
      let newVariantStockFinal = prod.variant_stock;

      if (variantKeys.length > 0) {
        const newVariantStock: Record<string, number> = { ...(prod.variant_stock || {}) };
        let total = 0;
        variantKeys.forEach((k) => {
          const editKey = `${prod.id}__${k}`;
          const raw = stockEdits[editKey];
          const current = Number(prod.variant_stock?.[k] ?? 0);
          const value = raw !== undefined ? parseInt(raw) : current;
          const safe = isNaN(value) || value < 0 ? 0 : value;
          newVariantStock[k] = safe;
          total += safe;
        });
        updatePayload.variant_stock = newVariantStock;
        updatePayload.stock = total;
        newStockTotal = total;
        newVariantStockFinal = newVariantStock;
      } else {
        const raw = stockEdits[prod.id];
        if (raw !== undefined) {
          const newQty = parseInt(raw);
          if (isNaN(newQty) || newQty < 0) {
            toast({ title: "خطأ", description: "كمية غير صالحة", variant: "destructive" });
            setSavingStock(null);
            return;
          }
          updatePayload.stock = newQty;
          newStockTotal = newQty;
        }
      }

      if (Object.keys(updatePayload).length === 0) {
        setSavingStock(null);
        return;
      }

      const { error } = await supabase.from("products").update(updatePayload).eq("id", prod.id);
      if (error) throw error;
      setProductsList((prev) =>
        prev.map((p) =>
          p.id === prod.id
            ? { ...p, purchase_price: newPurchase, stock: newStockTotal, variant_stock: newVariantStockFinal }
            : p
        )
      );
      toast({ title: "تم التحديث", description: "تم حفظ التغييرات" });
      setStockEdits((prev) => {
        const copy = { ...prev };
        Object.keys(copy).forEach((k) => {
          if (k === prod.id || k.startsWith(`${prod.id}__`)) delete copy[k];
        });
        return copy;
      });
      setPriceEdits((prev) => {
        const copy = { ...prev };
        delete copy[`price__${prod.id}`];
        return copy;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "خطأ", description: "تعذر حفظ التغييرات", variant: "destructive" });
    } finally {
      setSavingStock(null);
    }
  };

  // Delivered orders
  const deliveredOrders = orders.filter((o) => o.status === "delivered");
  const uniqueProducts = [...new Set(deliveredOrders.map((o) => o.product_name))];
  const filteredDeliveredOrders =
    selectedProduct === "all" ? deliveredOrders : deliveredOrders.filter((o) => o.product_name === selectedProduct);

  const productByName = new Map(productsList.map((p) => [p.name, p]));

  const totalRevenue = filteredDeliveredOrders.reduce((sum, o) => sum + Number(o.price), 0);
  const totalPurchaseCost = filteredDeliveredOrders.reduce((sum, order) => {
    const prod = productByName.get(order.product_name);
    return sum + (prod ? Number(prod.purchase_price) : 0);
  }, 0);
  const totalProfit = totalRevenue - totalPurchaseCost;

  const getOrderProfit = (order: Order) => {
    const prod = productByName.get(order.product_name);
    return Number(order.price) - (prod ? Number(prod.purchase_price) : 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الحسابات المالية</h1>
        <p className="text-muted-foreground">إدارة المخزون ومتابعة الأرباح</p>
      </div>

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Boxes className="w-4 h-4" />
            المخزون
          </TabsTrigger>
          <TabsTrigger value="profits" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            الأرباح
          </TabsTrigger>
        </TabsList>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="w-5 h-5" />
                إدارة المخزون
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Boxes className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>لا توجد منتجات. أضف المنتجات من قسم "المنتجات" أولاً.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {productsList.map((prod) => {
                    const variantKeys = getVariantKeys(prod);
                    const stockChanged = variantKeys.length > 0
                      ? variantKeys.some((k) => {
                          const editKey = `${prod.id}__${k}`;
                          const current = String(prod.variant_stock?.[k] ?? 0);
                          return stockEdits[editKey] !== undefined && stockEdits[editKey] !== current;
                        })
                      : stockEdits[prod.id] !== undefined && stockEdits[prod.id] !== String(prod.stock);
                    const priceKey = `price__${prod.id}`;
                    const priceChanged =
                      priceEdits[priceKey] !== undefined &&
                      priceEdits[priceKey] !== String(prod.purchase_price);
                    const hasChanges = stockChanged || priceChanged;

                    return (
                      <div key={prod.id} className="border rounded-lg overflow-hidden">
                        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/40 border-b">
                          <div className="flex-1 min-w-[180px]">
                            <p className="font-bold text-foreground">{prod.name}</p>
                            <p className="text-xs text-muted-foreground">
                              سعر البيع: {Number(prod.price).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">سعر الشراء:</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-24 h-8"
                              value={priceEdits[priceKey] ?? String(prod.purchase_price)}
                              onChange={(e) =>
                                setPriceEdits((prev) => ({ ...prev, [priceKey]: e.target.value }))
                              }
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">الإجمالي:</span>
                            <span
                              className={`px-2 py-1 rounded text-sm font-semibold ${
                                prod.stock <= 0
                                  ? "bg-red-500/10 text-red-500"
                                  : prod.stock < 5
                                  ? "bg-orange-500/10 text-orange-500"
                                  : "bg-green-500/10 text-green-500"
                              }`}
                            >
                              {prod.stock}
                            </span>
                            <Button
                              size="sm"
                              disabled={!hasChanges || savingStock === prod.id}
                              onClick={() => handleSaveProductStock(prod)}
                            >
                              <Save className="w-4 h-4 ml-1" />
                              حفظ
                            </Button>
                          </div>
                        </div>

                        {variantKeys.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">المتغير</TableHead>
                                <TableHead className="text-right">الكمية الحالية</TableHead>
                                <TableHead className="text-right">تعديل</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {variantKeys.map((k) => {
                                const editKey = `${prod.id}__${k}`;
                                const current = Number(prod.variant_stock?.[k] ?? 0);
                                const editValue = stockEdits[editKey] ?? String(current);
                                return (
                                  <TableRow key={editKey}>
                                    <TableCell className="text-muted-foreground">{k}</TableCell>
                                    <TableCell>
                                      <span
                                        className={`px-2 py-1 rounded ${
                                          current <= 0
                                            ? "bg-red-500/10 text-red-500"
                                            : current < 5
                                            ? "bg-orange-500/10 text-orange-500"
                                            : "bg-green-500/10 text-green-500"
                                        }`}
                                      >
                                        {current}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={editValue}
                                        onChange={(e) => setStockEdits({ ...stockEdits, [editKey]: e.target.value })}
                                        className="w-24"
                                      />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="p-4 flex items-center gap-3">
                            <Label className="text-sm">الكمية المتوفرة:</Label>
                            <Input
                              type="number"
                              min="0"
                              value={stockEdits[prod.id] ?? String(prod.stock)}
                              onChange={(e) => setStockEdits({ ...stockEdits, [prod.id]: e.target.value })}
                              className="w-32"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profits Tab */}
        <TabsContent value="profits" className="space-y-6">
          <Card className="card-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <Filter className="w-5 h-5 text-muted-foreground" />
                <Label className="text-sm font-medium">فلترة حسب المنتج:</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="اختر المنتج" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المنتجات</SelectItem>
                    {uniqueProducts.map((product) => (
                      <SelectItem key={product} value={product}>
                        {product}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProduct !== "all" && (
                  <Button variant="outline" size="sm" onClick={() => setSelectedProduct("all")}>
                    إلغاء الفلترة
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <DollarSign className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                    <p className="text-xl font-bold text-foreground">{totalRevenue.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">صافي الربح</p>
                    <p className={`text-xl font-bold ${totalProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {totalProfit.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">طلبات مكتملة</p>
                    <p className="text-xl font-bold text-foreground">{filteredDeliveredOrders.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-green-500/30">
            <CardHeader className="bg-gradient-to-r from-green-500/10 to-transparent">
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                الطلبات المستلمة والأرباح
                {selectedProduct !== "all" && (
                  <span className="text-sm font-normal text-muted-foreground">({selectedProduct})</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredDeliveredOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>لا توجد طلبات مستلمة حتى الآن</p>
                  <p className="text-sm">عند تغيير حالة الطلب إلى "تم التسليم" ستظهر هنا</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">العميل</TableHead>
                      <TableHead className="text-right">المنتج</TableHead>
                      <TableHead className="text-right">سعر البيع</TableHead>
                      <TableHead className="text-right">سعر الشراء</TableHead>
                      <TableHead className="text-right">الربح</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeliveredOrders.map((order) => {
                      const prod = productByName.get(order.product_name);
                      const purchasePrice = prod ? Number(prod.purchase_price) : 0;
                      const profit = getOrderProfit(order);
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.customer_name}</TableCell>
                          <TableCell>{order.product_name}</TableCell>
                          <TableCell>{Number(order.price).toFixed(2)}</TableCell>
                          <TableCell>{purchasePrice.toFixed(2)}</TableCell>
                          <TableCell className={profit >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                            {profit.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString("ar-SA")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinancialAccounts;
