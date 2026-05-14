import { useState, useEffect, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Eye, EyeOff, Trash2, Package, Edit, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ProductFormData } from "@/components/ProductForm";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { isolateLatin } from "@/lib/bidi";

const ProductForm = lazy(() => import("@/components/ProductForm"));

interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  original_price?: string;
  purchase_price: string;
  description: string;
  images: string[];
  product_codes?: string[];
  colors?: string[];
  sizes?: string[];
  is_visible: boolean;
  stock?: number;
  variant_stock?: Record<string, number>;
}

interface StoreSettings {
  currency_symbol: string;
}

const emptyFormData: ProductFormData = {
  name: "",
  slug: "",
  price: "",
  originalPrice: "",
  purchasePrice: "",
  stock: "",
  variantStock: {},
  variantWarehouseCodes: {},
  variantEasyOrdersIds: {},
  easyOrdersProductId: "",
  description: "",
  images: [],
  features: "",
  productCodes: "",
  colors: "",
  sizes: "",
  warehouseLinked: true,
  upsellEnabled: false,
  upsellOffers: [],
};

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<ProductFormData>(emptyFormData);
  const [editProduct, setEditProduct] = useState<ProductFormData>(emptyFormData);
  const { isAdmin, loading: userLoading } = useUserContext();
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({ currency_symbol: "د.إ" });

  const runWithTimeout = async <T,>(request: PromiseLike<T>, timeoutMs = 30000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("انتهت مهلة تحميل المنتجات")), timeoutMs);
    });
    return Promise.race([Promise.resolve(request), timeout]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
  };

  // Two-phase load: fast metadata first, images in background
  useEffect(() => {
    if (userLoading) return;
    let cancelled = false;

    const loadProducts = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        // Phase 1: lightweight metadata only (no images) — fast
        let metaQuery = supabase
          .from("products")
          .select("id, name, slug, price, original_price, purchase_price, is_visible")
          .order("created_at", { ascending: false });
        if (!isAdmin) metaQuery = metaQuery.eq("owner_id", user.id);
        const { data: metaData, error: metaError } = await runWithTimeout(metaQuery, 15000);

        if (metaError) throw metaError;
        if (cancelled) return;

        const baseList: Product[] = (metaData || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: String(p.price),
          original_price: p.original_price ? String(p.original_price) : undefined,
          purchase_price: p.purchase_price != null ? String(p.purchase_price) : "0",
          description: "",
          images: [],
          product_codes: [],
          colors: [],
          sizes: [],
          is_visible: p.is_visible ?? true,
        }));
        setProducts(baseList);
        setIsLoading(false);

        // Phase 2: load images in background (heavy column)
        let imgQuery = supabase.from("products").select("id, images");
        if (!isAdmin) imgQuery = imgQuery.eq("owner_id", user.id);
        const { data: imgData } = await imgQuery;
        if (cancelled || !imgData) return;
        const imgMap = new Map<string, string[]>(
          imgData.map((r: any) => [r.id as string, (r.images as string[]) || []])
        );
        setProducts((prev) =>
          prev.map((p) => ({ ...p, images: imgMap.get(p.id) || [] }))
        );
      } catch (error) {
        console.error("Error fetching products:", error);
        if (!cancelled) {
          toast({
            title: "خطأ",
            description: "حدث خطأ أثناء تحميل المنتجات",
            variant: "destructive",
          });
          setIsLoading(false);
        }
      }
    };

    loadProducts();

    // Currency in background (non-blocking)
    supabase.from("store_settings").select("currency_symbol").limit(1).maybeSingle().then(({ data }) => {
      if (!cancelled && data) {
        setStoreSettings({ currency_symbol: data.currency_symbol });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, userLoading]);

  const fetchProducts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let query = supabase
        .from("products")
        .select("id, name, slug, price, original_price, purchase_price, images, is_visible")
        .order("created_at", { ascending: false });
      if (!isAdmin) query = query.eq("owner_id", user.id);
      const { data, error } = await runWithTimeout(query, 30000);

      if (error) throw error;

      setProducts(
        (data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: String(p.price),
          original_price: p.original_price ? String(p.original_price) : undefined,
          purchase_price: p.purchase_price != null ? String(p.purchase_price) : "0",
          description: "",
          images: p.images || [],
          product_codes: [],
          colors: [],
          sizes: [],
          is_visible: p.is_visible ?? true,
        }))
      );
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل المنتجات",
        variant: "destructive",
      });
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price || !newProduct.slug) {
      toast({
        title: "خطأ",
        description: "يرجى ملء اسم المنتج والسعر ورابط المنتج",
        variant: "destructive",
      });
      return;
    }

    if (newProduct.images.length === 0) {
      toast({
        title: "خطأ",
        description: "يرجى رفع صورة واحدة على الأقل",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const productCodesArray = newProduct.productCodes ? newProduct.productCodes.split(",").map(c => c.trim()).filter(Boolean) : [];
      const colorsArray = newProduct.colors ? newProduct.colors.split(",").map(c => c.trim()).filter(Boolean) : [];
      const sizesArray = newProduct.sizes ? newProduct.sizes.split(",").map(s => s.trim()).filter(Boolean) : [];

      // Build variant_stock (numeric) only for existing variant keys
      const { buildVariantKeys } = await import("@/components/ProductForm");
      const variantKeys = buildVariantKeys(newProduct.colors, newProduct.sizes, newProduct.productCodes);
      const variantStockNum: Record<string, number> = {};
      let totalVariantQty = 0;
      variantKeys.forEach((k) => {
        const n = parseInt(newProduct.variantStock[k] || "0");
        const v = isNaN(n) || n < 0 ? 0 : n;
        variantStockNum[k] = v;
        totalVariantQty += v;
      });
      const stockNum = variantKeys.length > 0
        ? totalVariantQty
        : (newProduct.stock ? Math.max(0, parseInt(newProduct.stock) || 0) : 0);

      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("products").insert({
        owner_id: user!.id,
        name: newProduct.name,
        slug: newProduct.slug,
        price: parseFloat(newProduct.price),
        original_price: newProduct.originalPrice ? parseFloat(newProduct.originalPrice) : null,
        purchase_price: newProduct.purchasePrice ? parseFloat(newProduct.purchasePrice) : 0,
        description: newProduct.description,
        images: newProduct.images,
        product_codes: productCodesArray,
        colors: colorsArray,
        sizes: sizesArray,
        stock: stockNum,
        variant_stock: variantStockNum,
        variant_warehouse_codes: Object.fromEntries(
          variantKeys.map((k) => [k, (newProduct.variantWarehouseCodes?.[k] || "").trim()]).filter(([, v]) => v)
        ),
        easyorders_product_id: newProduct.easyOrdersProductId?.trim() || null,
        variant_easyorders_ids: Object.fromEntries(
          variantKeys.map((k) => [k, (newProduct.variantEasyOrdersIds?.[k] || "").trim()]).filter(([, v]) => v)
        ),
      warehouse_linked: newProduct.warehouseLinked !== false,
      upsell_enabled: !!newProduct.upsellEnabled,
      upsell_offers: (newProduct.upsellOffers || [])
        .map((o) => ({
          quantity: Math.max(1, parseInt(o.quantity) || 0),
          price: Math.max(0, parseFloat(o.price) || 0),
          label: (o.label || "").trim(),
        }))
        .filter((o) => o.quantity > 0 && o.price > 0),
      }).select("id").single();

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "خطأ",
            description: "رابط المنتج موجود مسبقاً، يرجى اختيار رابط آخر",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      // Add to list directly without refetching
      const newProductData: Product = {
        id: data.id,
        name: newProduct.name,
        slug: newProduct.slug,
        price: newProduct.price,
        original_price: newProduct.originalPrice || undefined,
        purchase_price: newProduct.purchasePrice || "0",
        description: newProduct.description,
        images: newProduct.images,
        product_codes: productCodesArray,
        colors: colorsArray,
        sizes: sizesArray,
        is_visible: true,
        stock: stockNum,
        variant_stock: variantStockNum,
      };
      setProducts(prev => [newProductData, ...prev]);
      setNewProduct(emptyFormData);
      setIsAddOpen(false);
      toast({
        title: "تم بنجاح",
        description: "تم إضافة المنتج بنجاح",
      });
    } catch (error) {
      console.error("Error adding product:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إضافة المنتج",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditProduct = async () => {
    if (!editingProductId || !editProduct.name || !editProduct.price || !editProduct.slug) {
      toast({
        title: "خطأ",
        description: "يرجى ملء اسم المنتج والسعر ورابط المنتج",
        variant: "destructive",
      });
      return;
    }

    if (editProduct.images.length === 0) {
      toast({
        title: "خطأ",
        description: "يرجى رفع صورة واحدة على الأقل",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const productCodesArray = editProduct.productCodes ? editProduct.productCodes.split(",").map(c => c.trim()).filter(Boolean) : [];
      const colorsArray = editProduct.colors ? editProduct.colors.split(",").map(c => c.trim()).filter(Boolean) : [];
      const sizesArray = editProduct.sizes ? editProduct.sizes.split(",").map(s => s.trim()).filter(Boolean) : [];

      const { buildVariantKeys } = await import("@/components/ProductForm");
      const variantKeys = buildVariantKeys(editProduct.colors, editProduct.sizes, editProduct.productCodes);
      const variantStockNum: Record<string, number> = {};
      let totalVariantQty = 0;
      variantKeys.forEach((k) => {
        const n = parseInt(editProduct.variantStock[k] || "0");
        const v = isNaN(n) || n < 0 ? 0 : n;
        variantStockNum[k] = v;
        totalVariantQty += v;
      });
      const stockNum = variantKeys.length > 0
        ? totalVariantQty
        : (editProduct.stock ? Math.max(0, parseInt(editProduct.stock) || 0) : 0);

      // Only include images if they actually changed (images can be heavy base64)
      const originalProduct = products.find(p => p.id === editingProductId);
      const imagesChanged = !originalProduct
        || originalProduct.images.length !== editProduct.images.length
        || originalProduct.images.some((img, i) => img !== editProduct.images[i]);

      const updatePayload: any = {
        name: editProduct.name,
        slug: editProduct.slug,
        price: parseFloat(editProduct.price),
        original_price: editProduct.originalPrice ? parseFloat(editProduct.originalPrice) : null,
        purchase_price: editProduct.purchasePrice ? parseFloat(editProduct.purchasePrice) : 0,
        description: editProduct.description,
        product_codes: productCodesArray,
        colors: colorsArray,
        sizes: sizesArray,
        stock: stockNum,
        variant_stock: variantStockNum,
        variant_warehouse_codes: Object.fromEntries(
          variantKeys.map((k) => [k, (editProduct.variantWarehouseCodes?.[k] || "").trim()]).filter(([, v]) => v)
        ),
        easyorders_product_id: editProduct.easyOrdersProductId?.trim() || null,
        variant_easyorders_ids: Object.fromEntries(
          variantKeys.map((k) => [k, (editProduct.variantEasyOrdersIds?.[k] || "").trim()]).filter(([, v]) => v)
        ),
      warehouse_linked: editProduct.warehouseLinked !== false,
      upsell_enabled: !!editProduct.upsellEnabled,
      upsell_offers: (editProduct.upsellOffers || [])
        .map((o) => ({
          quantity: Math.max(1, parseInt(o.quantity) || 0),
          price: Math.max(0, parseFloat(o.price) || 0),
          label: (o.label || "").trim(),
        }))
        .filter((o) => o.quantity > 0 && o.price > 0),
      };
      if (imagesChanged) updatePayload.images = editProduct.images;

      const { error } = await supabase
        .from("products")
        .update(updatePayload)
        .eq("id", editingProductId);

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "خطأ",
            description: "رابط المنتج موجود مسبقاً، يرجى اختيار رابط آخر",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      // Update list directly without refetching
      setProducts(prev => prev.map(p => 
        p.id === editingProductId ? {
          id: editingProductId,
          name: editProduct.name,
          slug: editProduct.slug,
          price: editProduct.price,
          original_price: editProduct.originalPrice || undefined,
          purchase_price: editProduct.purchasePrice || "0",
          description: editProduct.description,
          images: editProduct.images,
          product_codes: productCodesArray,
          colors: colorsArray,
          sizes: sizesArray,
          is_visible: p.is_visible,
          stock: stockNum,
          variant_stock: variantStockNum,
        } : p
      ));
      setEditingProductId(null);
      setEditProduct(emptyFormData);
      setIsEditOpen(false);
      toast({
        title: "تم بنجاح",
        description: "تم تحديث المنتج بنجاح",
      });
    } catch (error) {
      console.error("Error updating product:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحديث المنتج",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = async (product: Product) => {
    setEditingProductId(product.id);
    setEditProduct({
      name: product.name,
      slug: product.slug,
      price: product.price,
      originalPrice: product.original_price || "",
      purchasePrice: product.purchase_price || "",
      stock: product.stock != null ? String(product.stock) : "",
      variantStock: product.variant_stock
        ? Object.fromEntries(Object.entries(product.variant_stock).map(([k, v]) => [k, String(v)]))
        : {},
      variantWarehouseCodes: {},
      variantEasyOrdersIds: {},
      easyOrdersProductId: "",
      description: product.description,
      images: product.images,
      features: "",
      productCodes: product.product_codes?.join(", ") || "",
      colors: product.colors?.join(", ") || "",
      sizes: product.sizes?.join(", ") || "",
      warehouseLinked: true,
      upsellEnabled: false,
      upsellOffers: [],
    });
    setIsEditOpen(true);

    setIsEditLoading(true);
    try {
      const { data, error } = await runWithTimeout(
        supabase
          .from("products")
          .select("description, product_codes, colors, sizes, stock, variant_stock, variant_warehouse_codes, easyorders_product_id, variant_easyorders_ids, warehouse_linked, upsell_enabled, upsell_offers")
          .eq("id", product.id)
          .single()
      );

      if (error) throw error;

      setEditProduct((current) => ({
        ...current,
        description: (data as any).description || "",
        productCodes: (data as any).product_codes?.join(", ") || "",
        colors: (data as any).colors?.join(", ") || "",
        sizes: (data as any).sizes?.join(", ") || "",
        stock: (data as any).stock != null ? String((data as any).stock) : "",
        variantStock: (data as any).variant_stock
          ? Object.fromEntries(
              Object.entries((data as any).variant_stock as Record<string, any>).map(([k, v]) => [k, String(v)])
            )
          : {},
        variantWarehouseCodes: (data as any).variant_warehouse_codes
          ? Object.fromEntries(
              Object.entries((data as any).variant_warehouse_codes as Record<string, any>).map(([k, v]) => [k, String(v)])
            )
          : {},
        easyOrdersProductId: (data as any).easyorders_product_id || "",
        variantEasyOrdersIds: (data as any).variant_easyorders_ids
          ? Object.fromEntries(
              Object.entries((data as any).variant_easyorders_ids as Record<string, any>).map(([k, v]) => [k, String(v)])
            )
          : {},
        warehouseLinked: (data as any).warehouse_linked !== false,
      }));
    } catch (error) {
      console.error("Error loading product details:", error);
      toast({
        title: "تنبيه",
        description: "تم فتح المنتج، لكن تعذر تحميل التفاصيل الكاملة",
        variant: "destructive",
      });
    } finally {
      setIsEditLoading(false);
    }
  };

  const openPreviewPage = (slug: string) => {
    window.open(`/p/${slug}`, "_blank");
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);

      if (error) throw error;

      await fetchProducts();
      toast({
        title: "تم الحذف",
        description: "تم حذف المنتج بنجاح",
      });
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف المنتج",
        variant: "destructive",
      });
    }
  };

  const toggleVisibility = async (product: Product) => {
    const newVisibility = !product.is_visible;
    // Optimistic update
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_visible: newVisibility } : p));
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_visible: newVisibility })
        .eq("id", product.id);
      if (error) throw error;
      toast({
        title: newVisibility ? "تم إظهار المنتج" : "تم إخفاء المنتج",
        description: newVisibility ? "أصبح المنتج مرئياً للزوار" : "تم إخفاء المنتج عن الزوار",
      });
    } catch (error) {
      console.error("Error toggling visibility:", error);
      // Revert
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_visible: !newVisibility } : p));
      toast({
        title: "خطأ",
        description: "تعذر تحديث حالة المنتج",
        variant: "destructive",
      });
    }
  };

  const copyProductUrl = (slug: string) => {
    const url = `${window.location.origin}/p/${slug}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "تم النسخ",
      description: "تم نسخ رابط المنتج بنجاح",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">المنتجات</h1>
          <p className="text-sm text-muted-foreground">إدارة منتجات صفحات الهبوط</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              إضافة منتج
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>إضافة منتج جديد</DialogTitle>
            </DialogHeader>
            <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
              <ProductForm
                product={newProduct}
                onProductChange={setNewProduct}
                onSubmit={handleAddProduct}
                submitText="إضافة المنتج"
                isLoading={isSaving}
              />
            </Suspense>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog - Full page */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent
          className="max-w-none w-screen h-screen sm:rounded-none p-0 gap-0 translate-x-0 translate-y-0 left-0 top-0 border-0 flex flex-col"
          aria-describedby={undefined}
        >
          <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0">
            <DialogTitle>تعديل المنتج</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
              <ProductForm
                product={editProduct}
                onProductChange={setEditProduct}
                onSubmit={handleEditProduct}
                submitText="حفظ التعديلات"
                isLoading={isSaving || isEditLoading}
              />
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>

      {/* Products Grid */}
      {products.length === 0 ? (
        <Card className="card-shadow">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد منتجات حالياً</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card key={product.id} className={`card-shadow overflow-hidden animate-slide-up ${!product.is_visible ? 'opacity-60' : ''}`}>
              <div className="aspect-video relative overflow-hidden bg-muted">
                {product.images[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-10 h-10 text-muted-foreground/50" />
                  </div>
                )}
                {product.images.length > 1 && (
                  <span className="absolute bottom-2 left-2 bg-foreground/70 text-background text-xs px-2 py-1 rounded">
                    +{product.images.length - 1} صور
                  </span>
                )}
                {!product.is_visible && (
                  <span className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded font-semibold">
                    مخفي
                  </span>
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-foreground">{isolateLatin(product.name)}</h3>
                  <div className="text-left">
                    <span className="text-primary font-bold">{product.price} {storeSettings.currency_symbol}</span>
                    {product.original_price && (
                      <span className="text-muted-foreground line-through text-sm mr-2">
                        {product.original_price} {storeSettings.currency_symbol}
                      </span>
                    )}
                  </div>
                </div>

                {/* Product URL */}
                <div className="flex items-center gap-2 mb-4 p-2 bg-muted rounded-lg">
                  <span className="text-xs text-muted-foreground truncate flex-1" dir="ltr">
                    /p/{product.slug}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyProductUrl(product.slug)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-0 gap-1 sm:gap-2 text-xs sm:text-sm"
                    onClick={() => openPreviewPage(product.slug)}
                  >
                    <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">معاينة</span>
                    <ExternalLink className="w-2 h-2 sm:w-3 sm:h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleVisibility(product)}
                    className="px-2 sm:px-3"
                    title={product.is_visible ? "إخفاء المنتج" : "إظهار المنتج"}
                  >
                    {product.is_visible ? (
                      <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" />
                    ) : (
                      <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(product)}
                    className="px-2 sm:px-3"
                  >
                    <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground px-2 sm:px-3"
                    onClick={() => handleDelete(product.id)}
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Products;
