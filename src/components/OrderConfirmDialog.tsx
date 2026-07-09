import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const COUNTDOWN_SECONDS = 3;

interface OrderConfirmDialogProps {
  open: boolean;
  message: string;
  submitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function OrderConfirmDialog({
  open,
  message,
  submitting,
  onConfirm,
  onCancel,
}: OrderConfirmDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (!open) {
      setSecondsLeft(COUNTDOWN_SECONDS);
      return;
    }
    setSecondsLeft(COUNTDOWN_SECONDS);
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const canConfirm = secondsLeft <= 0 && !submitting;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) onCancel(); }}>
      <DialogContent className="max-w-md sm:max-w-md" aria-describedby="order-confirm-desc">
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle className="text-xl">تأكيد الطلب</DialogTitle>
          <DialogDescription id="order-confirm-desc" className="sr-only">
            اقرأ الرسالة ثم أكّد الطلب بعد العد التنازلي
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-4 text-base leading-relaxed text-foreground whitespace-pre-wrap text-right">
          {message.trim() || "هل أنت متأكد من إرسال الطلب؟"}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className={
              canConfirm
                ? "w-full py-6 text-base font-bold bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                : "w-full py-6 text-base font-bold opacity-40 cursor-not-allowed bg-emerald-600/50 text-white"
            }
          >
            {submitting
              ? "جاري الإرسال..."
              : secondsLeft > 0
                ? `تأكيد (${secondsLeft})`
                : "تأكيد"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!!submitting}
            onClick={onCancel}
            className="w-full"
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
