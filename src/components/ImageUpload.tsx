import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressImageToBlob, isDataUrl, uploadProductImage } from "@/lib/imageStorage";

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  /** When set, new uploads go to Supabase Storage instead of base64 in DB. */
  ownerId?: string | null;
  storeId?: string | null;
}

const ImageUpload = ({ images, onImagesChange, maxImages = 5, ownerId, storeId }: ImageUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileToUrl = async (file: File): Promise<string> => {
    if (ownerId) {
      return uploadProductImage(file, ownerId, storeId);
    }
    const blob = await compressImageToBlob(file);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || uploading) return;
    const remainingSlots = maxImages - images.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of filesToProcess) {
        if (!file.type.startsWith("image/")) continue;
        try {
          uploaded.push(await fileToUrl(file));
        } catch (err) {
          console.error("Image upload failed:", err);
        }
      }
      if (uploaded.length) onImagesChange([...images, ...uploaded]);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  return (
    <div className="space-y-4">
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          (images.length >= maxImages || uploading) && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={images.length >= maxImages || uploading}
        />
        {uploading ? (
          <Loader2 className="w-10 h-10 mx-auto text-muted-foreground mb-2 animate-spin" />
        ) : (
          <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        )}
        <p className="text-foreground font-medium">
          {uploading ? "جارِ رفع الصور…" : "اسحب الصور هنا أو انقر للرفع"}
        </p>
        <p className="text-muted-foreground text-sm mt-1">
          PNG, JPG, WEBP حتى {maxImages} صور
          {ownerId ? " — تُرفع على CDN" : ""}
        </p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {images.map((image, index) => (
            <div
              key={`${image.slice(0, 32)}-${index}`}
              className="relative group aspect-square rounded-lg overflow-hidden bg-muted"
            >
              <img
                src={image}
                alt={`صورة ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {index === 0 && (
                <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                  رئيسية
                </span>
              )}
              {isDataUrl(image) && (
                <span className="absolute bottom-1 left-1 bg-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded">
                  محلي
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <ImageIcon className="w-4 h-4" />
          <span>لم يتم رفع أي صور بعد</span>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
