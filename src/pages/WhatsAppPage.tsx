import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";

export default function WhatsAppPage() {
  return <div className="space-y-4" dir="rtl">
    <PageHeader title="واتساب" icon={MessageCircle} />
    <Card className="p-6 space-y-2">
      <h2 className="font-bold">تكامل واتساب معطّل</h2>
      <p>تم إيقاف الإرسال والاستقبال والتأكيد الآلي عبر واتساب.</p>
      <p className="text-muted-foreground">بيانات المحادثات السابقة والزبائن والطلبات محفوظة. يمكنك متابعة الطلبات من مركز التأكيد.</p>
    </Card>
  </div>;
}
