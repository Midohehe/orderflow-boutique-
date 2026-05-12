import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, DollarSign, CheckCircle, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
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
  purchase_price: number;
}

const FinancialAccounts = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [productsList, setProductsList] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string>("all");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const productsQuery = user
          ? supabase.from("products").select("id, name, purchase_price").eq("owner_id", user.id)
          : supabase.from("products").select("id, name, purchase_price");
        const [ordersRes, productsRes] = await Promise.all([
          supabase.from("orders").select("id, product_name, price, status, customer_name, created_at").order("created_at", { ascending: false }),
          productsQuery,
        ]);
        if (ordersRes.error) throw ordersRes.error;
        if (productsRes.error) throw productsRes.error;
        setOrders(ordersRes.data || []);
        setProductsList((productsRes.data as ProductRow[]) || []);
      } catch (error) {
        console.error(error);
        toast({ title: "خطأ", description: "حدث خطأ أثناء تحميل البيانات", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
        <p className="text-muted-foreground">متابعة الأرباح من الطلبات المسلّمة</p>
      </div>

      <Card className="card-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <Label className="text-sm font-medium">فلترة حسب المنتج:</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="w-64"><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المنتجات</SelectItem>
                {uniqueProducts.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProduct !== "all" && (
              <Button variant="outline" size="sm" onClick={() => setSelectedProduct("all")}>إلغاء الفلترة</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg"><DollarSign className="w-5 h-5 text-green-500" /></div>
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
              <div className="p-2 bg-purple-500/20 rounded-lg"><TrendingUp className="w-5 h-5 text-purple-500" /></div>
              <div>
                <p className="text-sm text-muted-foreground">صافي الربح</p>
                <p className={`text-xl font-bold ${totalProfit >= 0 ? "text-green-500" : "text-red-500"}`}>{totalProfit.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg"><CheckCircle className="w-5 h-5 text-orange-500" /></div>
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
                      <TableCell className={profit >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{profit.toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(order.created_at).toLocaleDateString("ar-SA")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialAccounts;
