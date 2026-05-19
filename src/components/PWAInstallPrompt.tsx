import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { toast } from "sonner";

export function PWAInstallButton({ className }: { className?: string }) {
  const { canInstall, promptInstall, installed } = usePWAInstall();
  const handleClick = async () => {
    if (installed) {
      toast.info("التطبيق مُثبّت بالفعل");
      return;
    }
    if (!canInstall) {
      const inIframe = window.self !== window.top;
      toast.info(inIframe ? "التثبيت متاح فقط من الرابط المنشور (لا يعمل داخل المعاينة)" : "التثبيت غير متاح في هذا المتصفح. جرّب Chrome على Android.");
      return;
    }
    await promptInstall();
  };
  return (
    <Button onClick={handleClick} size="sm" className={className} variant="default">
      <Download className="w-4 h-4 sm:ml-2" />
      <span className="hidden sm:inline">{installed ? "مُثبّت" : "تحميل التطبيق"}</span>
    </Button>
  );
}

export function PWAInstallPrompt() {
  const { canInstall, promptInstall, dismiss, isDismissed } = usePWAInstall();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (canInstall && !isDismissed()) {
      const t = setTimeout(() => setOpen(true), 2500);
      return () => clearTimeout(t);
    }
    setOpen(false);
  }, [canInstall, isDismissed]);

  if (!open || !canInstall) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 inset-x-4 z-[100] md:bottom-6 md:right-6 md:left-auto md:max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-5"
    >
      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="" width={48} height={48} className="rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-sm mb-1">ثبّت تطبيق صلة</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            احصل على تجربة أسرع وأسهل مع تطبيق صلة على جهازك.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={async () => {
                await promptInstall();
                setOpen(false);
              }}
              className="flex-1"
            >
              <Download className="w-4 h-4 ml-1.5" />
              تثبيت
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                dismiss();
                setOpen(false);
              }}
            >
              لاحقاً
            </Button>
          </div>
        </div>
        <button
          onClick={() => {
            dismiss();
            setOpen(false);
          }}
          aria-label="إغلاق"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}