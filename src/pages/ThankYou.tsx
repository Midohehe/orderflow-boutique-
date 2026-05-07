import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle, Package, Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const ThankYou = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const orderData = location.state?.orderData;

  useEffect(() => {
    // If no order data, redirect to home
    if (!orderData) {
      navigate("/");
    }
  }, [orderData, navigate]);

  if (!orderData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Success Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500">
            <CheckCircle className="w-14 h-14 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            تم استلام طلبك بنجاح!
          </h1>
          <p className="text-muted-foreground text-lg">
            شكراً لك على ثقتك بنا
          </p>
        </div>

        {/* Order Details Card */}
        <div className="bg-card rounded-2xl p-6 shadow-lg border mb-8 text-right">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2 justify-end">
            <span>تفاصيل الطلب</span>
            <Package className="w-5 h-5" />
          </h2>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-foreground font-medium">{orderData.productName}</span>
              <span className="text-muted-foreground">المنتج</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-foreground font-medium">{orderData.price} {orderData.currencySymbol || "د.إ"}</span>
              <span className="text-muted-foreground">السعر</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-foreground font-medium">{orderData.customerName}</span>
              <span className="text-muted-foreground">الاسم</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-foreground font-medium" dir="ltr">{orderData.phone}</span>
              <span className="text-muted-foreground">الهاتف</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-foreground font-medium">{orderData.city}</span>
              <span className="text-muted-foreground">المدينة</span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-primary/10 rounded-xl p-4 mb-8 flex items-center gap-3 justify-center">
          <Phone className="w-5 h-5 text-primary" />
          <p className="text-foreground text-sm">
            سنتواصل معك قريباً لتأكيد الطلب
          </p>
        </div>

        {/* Shipping Info */}
        <p className="text-muted-foreground text-sm mb-6">
          🚚 شحن سريع خلال 2-5 أيام عمل
        </p>
      </div>
    </div>
  );
};

export default ThankYou;