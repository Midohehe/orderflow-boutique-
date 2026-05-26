import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Send, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface ShippingOptionsValue {
  type_code: string;
  price_type_code: string;
  payment_type_code: string;
  openable_code: string;
}

const DEFAULTS: ShippingOptionsValue = {
  type_code: "FDP",
  price_type_code: "EXCLD",
  payment_type_code: "COLC",
  openable_code: "Y",
};

const STORAGE_KEY = "shipping_options_defaults_v1";

export function getShippingOptionsDefaults(): ShippingOptionsValue {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
}

const TYPE_OPTIONS = [
  { value: "FDP", label: "توصيل عادي (FDP)" },
  { value: "EXC", label: "استبدال (EXC)" },
  { value: "PIC", label: "استلام من العميل (PIC)" },
];

const PRICE_TYPE_OPTIONS = [
  { value: "EXCLD", label: "غير شامل الشحن" },
  { value: "INCLD", label: "شامل الشحن" },
];

const PAYMENT_TYPE_OPTIONS = [
  { value: "COLC", label: "كاش" },
  { value: "CASH", label: "مسددة نقدًا" },
  { value: "VISA", label: "دفع إلكتروني" },
];

const OPENABLE_OPTIONS = [
  { value: "Y", label: "مسموح بفتح الطرد" },
  { value: "N", label: "غير مسموح بفتح الطرد" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  onConfirm: (values: ShippingOptionsValue) => void;
}

export function ShippingOptionsDialog({ open, onOpenChange, count, onConfirm }: Props) {
  const [values, setValues] = useState<ShippingOptionsValue>(DEFAULTS);

  useEffect(() => {
    if (open) setValues(getShippingOptionsDefaults());
  }, [open]);

  const update = (key: keyof ShippingOptionsValue, v: string) =>
    setValues((p) => ({ ...p, [key]: v }));

  const saveDefault = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      toast({ title: "تم الحفظ", description: "تم حفظ هذه الخيارات كافتراضية" });
    } catch {
      toast({ title: "خطأ", description: "تعذر الحفظ", variant: "destructive" });
    }
  };

  const Field = (
    label: string,
    key: keyof ShippingOptionsValue,
    opts: { value: string; label: string }[],
  ) => (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Select value={values[key]} onValueChange={(v) => update(key, v)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opts.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>خيارات الشحن</DialogTitle>
          <DialogDescription>
            اختر تفضيلات الإرسال لشركة الشحن ({count} طلب)
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {Field("نوع الطلب", "type_code", TYPE_OPTIONS)}
          {Field("نوع السعر", "price_type_code", PRICE_TYPE_OPTIONS)}
          {Field("نوع الدفع", "payment_type_code", PAYMENT_TYPE_OPTIONS)}
          {Field("إمكانية فتح الطرد", "openable_code", OPENABLE_OPTIONS)}
        </div>
        <DialogFooter className="gap-2 sm:gap-2 flex-row flex-wrap justify-between">
          <Button type="button" variant="outline" onClick={saveDefault}>
            <Save className="w-4 h-4 ml-2" />
            حفظ كافتراضي
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button
              type="button"
              className="bg-lime-700 hover:bg-lime-700/90 text-white"
              onClick={() => { onConfirm(values); onOpenChange(false); }}
            >
              <Send className="w-4 h-4 ml-2" />
              تأكيد الإرسال
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}