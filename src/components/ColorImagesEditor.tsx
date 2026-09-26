import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { uploadProductImage } from "@/lib/imageStorage";
import { toast } from "@/hooks/use-toast";

interface Props {
  colors: string[];
  images: Record<string, string>;
  ownerId?: string | null;
  storeId?: string | null;
  onChange: (images: Record<string, string>) => void;
  onUploadingChange: (uploading: boolean) => void;
}

export default function ColorImagesEditor(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const [uploadingColor, setUploadingColor] = useState<string | null>(null);
  const busy = useRef(false);

  async function upload(color: string, file?: File) {
    if (!file || busy.current) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "اختر ملف صورة", variant: "destructive" });
      return;
    }
    if (!props.ownerId) {
      toast({ title: "تعذّر تحديد المتجر، أعد فتح المنتج", variant: "destructive" });
      return;
    }
    busy.current = true;
    setUploadingColor(color);
    props.onUploadingChange(true);
    try {
      const url = await uploadProductImage(file, props.ownerId, props.storeId);
      if (latest.current.colors.includes(color)) {
        latest.current.onChange({ ...latest.current.images, [color]: url });
      }
    } catch {
      toast({ title: "تعذّر رفع صورة اللون، حاول مرة أخرى", variant: "destructive" });
    } finally {
      busy.current = false;
      setUploadingColor(null);
      latest.current.onUploadingChange(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">صور الألوان (اختياري)</p>
        <p className="text-xs text-muted-foreground">أضف صورة لكل لون ليختار العميل منها في نموذج الطلب. اللون بدون صورة يظهر باسمه.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {props.colors.map((color) => (
          <div key={color} className="flex items-center gap-3 rounded-lg border p-3">
            {props.images[color] ? (
              <img src={props.images[color]} alt={color} className="h-16 w-16 shrink-0 rounded-md object-cover" />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">بدون صورة</span>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-semibold break-words">{color}</p>
              <label className="block text-xs">
                <span>{uploadingColor === color ? "جاري رفع الصورة..." : "رفع أو تغيير الصورة"}</span>
                <input type="file" accept="image/*" aria-label={`صورة اللون ${color}`}
                  disabled={uploadingColor !== null}
                  className="mt-1 block w-full text-xs"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    void upload(color, file);
                  }} />
              </label>
              {props.images[color] && (
                <Button type="button" size="sm" variant="ghost" disabled={uploadingColor !== null}
                  aria-label={`إزالة صورة اللون ${color}`}
                  onClick={() => {
                    const next = { ...props.images };
                    delete next[color];
                    props.onChange(next);
                  }}>إزالة الصورة</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
