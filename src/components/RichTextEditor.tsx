import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignRight, 
  AlignCenter, 
  AlignLeft,
  List,
  ListOrdered,
  Image as ImageIcon,
  Video,
  Link,
  Trash2,
  Highlighter,
  Eraser,
  Type
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const RichTextEditor = ({ value, onChange, placeholder }: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageWidth, setImageWidth] = useState("");
  const [imageHeight, setImageHeight] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync external value into the editor when it differs (e.g., async load on edit,
  // or form reset). Avoid clobbering during user typing by comparing with current DOM.
  useEffect(() => {
    if (!editorRef.current) return;
    const current = editorRef.current.innerHTML;
    if (!isInitialized.current) {
      editorRef.current.innerHTML = value || "";
      isInitialized.current = true;
      return;
    }
    if ((value || "") !== current && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  // Handle click outside to deselect image
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectedImage && !selectedImage.contains(e.target as Node)) {
        const isResizeHandle = (e.target as HTMLElement).closest('.resize-handle');
        const isDeleteButton = (e.target as HTMLElement).closest('.delete-image-btn');
        if (!isResizeHandle && !isDeleteButton) {
          setSelectedImage(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedImage]);

  // Handle resize mouse move
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !selectedImage) return;
    
    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;
    
    // Maintain aspect ratio
    const aspectRatio = resizeStart.width / resizeStart.height;
    let newWidth = Math.max(50, resizeStart.width + deltaX);
    let newHeight = newWidth / aspectRatio;
    
    selectedImage.style.width = `${newWidth}px`;
    selectedImage.style.height = `${newHeight}px`;
    selectedImage.setAttribute('width', String(Math.round(newWidth)));
    selectedImage.setAttribute('height', String(Math.round(newHeight)));
  }, [isResizing, selectedImage, resizeStart]);

  const handleResizeEnd = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      handleInput();
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const execCommand = (command: string, commandValue?: string) => {
    document.execCommand(command, false, commandValue);
    editorRef.current?.focus();
    handleInput();
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleImageUpload = (files: FileList | null) => {
    if (!files) return;
    
    const imageFiles = Array.from(files).filter(file => file.type.startsWith("image/"));
    const newImages: string[] = [];
    let loadedCount = 0;
    
    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        newImages.push(result);
        loadedCount++;
        
        if (loadedCount === imageFiles.length) {
          setPendingImages(prev => [...prev, ...newImages]);
          setShowImageDialog(true);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const insertImageWithSize = (src: string) => {
    const width = imageWidth ? `width="${imageWidth}"` : "";
    const height = imageHeight ? `height="${imageHeight}"` : "";
    const style = [];
    if (imageWidth) style.push(`width: ${imageWidth}px`);
    if (imageHeight) style.push(`height: ${imageHeight}px`);
    
    const img = `<img src="${src}" ${width} ${height} style="${style.join("; ")}" class="inline-block rounded-lg my-2 cursor-pointer" data-resizable="true" />`;
    execCommand("insertHTML", img);
    resetImageDialog();
  };

  const resetImageDialog = () => {
    setImageUrl("");
    setImageWidth("");
    setImageHeight("");
    setPendingImages([]);
    setShowImageDialog(false);
  };

  const insertImageFromUrl = () => {
    if (imageUrl) {
      insertImageWithSize(imageUrl);
    }
  };

  const insertPendingImages = () => {
    pendingImages.forEach(src => {
      const width = imageWidth ? `width="${imageWidth}"` : "";
      const height = imageHeight ? `height="${imageHeight}"` : "";
      const style = [];
      if (imageWidth) style.push(`width: ${imageWidth}px`);
      if (imageHeight) style.push(`height: ${imageHeight}px`);
      
      const img = `<img src="${src}" ${width} ${height} style="${style.join("; ")}" class="inline-block rounded-lg my-2 cursor-pointer" data-resizable="true" />`;
      document.execCommand("insertHTML", false, img);
    });
    editorRef.current?.focus();
    handleInput();
    resetImageDialog();
  };
  
  const removeImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const insertVideo = () => {
    if (videoUrl) {
      let embedUrl = videoUrl;
      if (videoUrl.includes("youtube.com/watch")) {
        const videoId = videoUrl.split("v=")[1]?.split("&")[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else if (videoUrl.includes("youtu.be/")) {
        const videoId = videoUrl.split("youtu.be/")[1]?.split("?")[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
      }
      
      const iframe = `<div class="video-container" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:16px 0;"><iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe></div>`;
      execCommand("insertHTML", iframe);
      setVideoUrl("");
      setShowVideoDialog(false);
    }
  };

  const insertLink = () => {
    if (linkUrl) {
      const link = `<a href="${linkUrl}" target="_blank" class="text-primary underline">${linkText || linkUrl}</a>`;
      execCommand("insertHTML", link);
      setLinkUrl("");
      setLinkText("");
      setShowLinkDialog(false);
    }
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      e.preventDefault();
      setSelectedImage(target as HTMLImageElement);
    }
  };

  const startResize = (e: React.MouseEvent, corner: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedImage) return;
    
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: selectedImage.offsetWidth,
      height: selectedImage.offsetHeight,
    });
  };

  const deleteSelectedImage = () => {
    if (selectedImage) {
      selectedImage.remove();
      setSelectedImage(null);
      handleInput();
    }
  };

  const ToolButton = ({ 
    onClick, 
    children, 
    title 
  }: { 
    onClick: () => void; 
    children: React.ReactNode; 
    title: string;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-muted flex-shrink-0"
      title={title}
    >
      {children}
    </Button>
  );

  // Get selected image position for overlay
  const getImageOverlayStyle = () => {
    if (!selectedImage || !editorRef.current) return {};
    
    const editorRect = editorRef.current.getBoundingClientRect();
    const imgRect = selectedImage.getBoundingClientRect();
    
    return {
      position: 'absolute' as const,
      left: imgRect.left - editorRect.left + editorRef.current.scrollLeft,
      top: imgRect.top - editorRect.top + editorRef.current.scrollTop,
      width: imgRect.width,
      height: imgRect.height,
    };
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 sm:gap-1 p-1.5 sm:p-2 border-b bg-muted/50 overflow-x-auto">
        <ToolButton onClick={() => execCommand("bold")} title="عريض">
          <Bold className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => execCommand("italic")} title="مائل">
          <Italic className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => execCommand("underline")} title="تسطير">
          <Underline className="w-4 h-4" />
        </ToolButton>

        <div className="w-px h-6 bg-border mx-1" />

        <select
          onMouseDown={(e) => e.preventDefault()}
          onChange={(e) => {
            const size = e.target.value;
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const span = document.createElement('span');
              span.style.fontSize = size;
              
              if (selection.isCollapsed) {
                // No text selected - insert span with zero-width space for future typing
                span.innerHTML = '&#8203;';
                range.insertNode(span);
                // Move cursor inside the span
                range.setStart(span.firstChild!, 1);
                range.setEnd(span.firstChild!, 1);
                selection.removeAllRanges();
                selection.addRange(range);
              } else {
                // Text is selected - wrap it
                range.surroundContents(span);
              }
              editorRef.current?.focus();
              handleInput();
            }
          }}
          className="h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm bg-card border border-border rounded-md cursor-pointer hover:bg-muted transition-colors focus:ring-2 focus:ring-primary focus:outline-none font-medium text-foreground flex-shrink-0"
          defaultValue="16px"
          title="حجم الخط"
          style={{ minWidth: '80px' }}
        >
          <option value="12px" className="py-2">صغير (12px)</option>
          <option value="14px" className="py-2">صغير+ (14px)</option>
          <option value="16px" className="py-2">عادي (16px)</option>
          <option value="20px" className="py-2">كبير (20px)</option>
          <option value="24px" className="py-2">كبير+ (24px)</option>
          <option value="32px" className="py-2">عنوان (32px)</option>
          <option value="40px" className="py-2">عنوان كبير (40px)</option>
        </select>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolButton onClick={() => execCommand("justifyRight")} title="محاذاة يمين">
          <AlignRight className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => execCommand("justifyCenter")} title="محاذاة وسط">
          <AlignCenter className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => execCommand("justifyLeft")} title="محاذاة يسار">
          <AlignLeft className="w-4 h-4" />
        </ToolButton>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolButton onClick={() => execCommand("insertUnorderedList")} title="قائمة نقطية">
          <List className="w-4 h-4" />
        </ToolButton>
        <ToolButton onClick={() => execCommand("insertOrderedList")} title="قائمة مرقمة">
          <ListOrdered className="w-4 h-4" />
        </ToolButton>

        <div className="w-px h-6 bg-border mx-1" />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleImageUpload(e.target.files)}
          className="hidden"
        />
        
        <Dialog open={showImageDialog} onOpenChange={(open) => {
          if (!open) resetImageDialog();
          setShowImageDialog(open);
        }}>
          <DialogTrigger asChild>
            <Button 
              type="button"
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 hover:bg-muted" 
              title="إضافة صورة"
              onMouseDown={(e) => e.preventDefault()}
            >
              <ImageIcon className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>إضافة صورة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full"
              >
                رفع صور من الجهاز (يمكنك اختيار عدة صور)
              </Button>
              
              {pendingImages.length === 0 && (
                <>
                  <div className="text-center text-muted-foreground">أو</div>
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="رابط الصورة..."
                    dir="ltr"
                  />
                </>
              )}
              
              {pendingImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">الصور المحددة ({pendingImages.length})</p>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-lg p-2 bg-muted/50">
                    {pendingImages.map((img, index) => (
                      <div key={index} className="relative group">
                        <img src={img} alt={`Preview ${index + 1}`} className="w-full h-20 object-cover rounded" />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <p className="text-sm font-medium">حجم الصور (اختياري - يطبق على الكل)</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      value={imageWidth}
                      onChange={(e) => setImageWidth(e.target.value)}
                      placeholder="العرض (px)"
                      type="number"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      value={imageHeight}
                      onChange={(e) => setImageHeight(e.target.value)}
                      placeholder="الارتفاع (px)"
                      type="number"
                      dir="ltr"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">اتركها فارغة للحجم الأصلي، أو اضغط على الصورة بعد إدراجها للتحكم بحجمها</p>
              </div>
              
              <Button 
                type="button" 
                onClick={pendingImages.length > 0 ? insertPendingImages : insertImageFromUrl} 
                className="w-full"
                disabled={pendingImages.length === 0 && !imageUrl}
              >
                {pendingImages.length > 1 ? `إدراج ${pendingImages.length} صور` : 'إدراج الصورة'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
          <DialogTrigger asChild>
            <Button 
              type="button"
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 hover:bg-muted" 
              title="إضافة فيديو"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Video className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>إضافة فيديو</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="رابط فيديو YouTube..."
                dir="ltr"
              />
              <p className="text-sm text-muted-foreground">
                أدخل رابط فيديو YouTube مثل: https://www.youtube.com/watch?v=xxxxx
              </p>
              <Button type="button" onClick={insertVideo} className="w-full">
                إدراج الفيديو
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
          <DialogTrigger asChild>
            <Button 
              type="button"
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 hover:bg-muted" 
              title="إضافة رابط"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Link className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>إضافة رابط</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Input
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="نص الرابط..."
              />
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                dir="ltr"
              />
              <Button type="button" onClick={insertLink} className="w-full">
                إدراج الرابط
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <input
          type="color"
          onMouseDown={(e) => e.preventDefault()}
          onChange={(e) => execCommand("foreColor", e.target.value)}
          className="w-7 h-7 sm:w-8 sm:h-8 p-1 border rounded cursor-pointer flex-shrink-0"
          title="لون النص"
        />

        <label
          className="relative w-7 h-7 sm:w-8 sm:h-8 border rounded cursor-pointer flex items-center justify-center hover:bg-muted flex-shrink-0"
          title="لون الخلفية (تظليل)"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Highlighter className="w-4 h-4 pointer-events-none" />
          <input
            type="color"
            onChange={(e) => {
              if (!document.execCommand("hiliteColor", false, e.target.value)) {
                execCommand("backColor", e.target.value);
              } else {
                handleInput();
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>

        <ToolButton
          onClick={() => {
            execCommand("hiliteColor", "transparent");
            execCommand("backColor", "transparent");
          }}
          title="إزالة لون الخلفية"
        >
          <Type className="w-4 h-4" />
        </ToolButton>

        <ToolButton
          onClick={() => {
            execCommand("removeFormat");
            execCommand("hiliteColor", "transparent");
            execCommand("backColor", "transparent");
          }}
          title="مسح التنسيق"
        >
          <Eraser className="w-4 h-4" />
        </ToolButton>
      </div>

      {/* Editor */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onClick={handleEditorClick}
          className={cn(
            "min-h-[200px] p-4 focus:outline-none",
            "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2 [&_img]:cursor-pointer",
            "[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground"
          )}
          data-placeholder={placeholder}
          style={{
            direction: "rtl",
          }}
        />
        
        {/* Image selection overlay */}
        {selectedImage && (
          <div 
            style={getImageOverlayStyle()}
            className="pointer-events-none border-2 border-primary rounded-lg"
          >
            {/* Corner resize handles */}
            <div
              className="resize-handle pointer-events-auto absolute -bottom-2 -right-2 w-4 h-4 bg-primary rounded-full cursor-se-resize border-2 border-background shadow-md"
              onMouseDown={(e) => startResize(e, 'se')}
            />
            <div
              className="resize-handle pointer-events-auto absolute -bottom-2 -left-2 w-4 h-4 bg-primary rounded-full cursor-sw-resize border-2 border-background shadow-md"
              onMouseDown={(e) => startResize(e, 'sw')}
            />
            <div
              className="resize-handle pointer-events-auto absolute -top-2 -right-2 w-4 h-4 bg-primary rounded-full cursor-ne-resize border-2 border-background shadow-md"
              onMouseDown={(e) => startResize(e, 'ne')}
            />
            <div
              className="resize-handle pointer-events-auto absolute -top-2 -left-2 w-4 h-4 bg-primary rounded-full cursor-nw-resize border-2 border-background shadow-md"
              onMouseDown={(e) => startResize(e, 'nw')}
            />
            
            {/* Delete button */}
            <button
              type="button"
              className="delete-image-btn pointer-events-auto absolute -top-3 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md hover:bg-destructive/90"
              onClick={deleteSelectedImage}
              title="حذف الصورة"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            
            {/* Size indicator */}
            <div className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 bg-background/90 text-xs px-2 py-0.5 rounded shadow border">
              {Math.round(selectedImage.offsetWidth)} × {Math.round(selectedImage.offsetHeight)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RichTextEditor;