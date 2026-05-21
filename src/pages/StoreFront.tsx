import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, ShoppingBag } from "lucide-react";
import StoreHeader from "@/components/StoreHeader";
import { isolateLatin } from "@/lib/bidi";
import FashionHero from "@/components/themes/FashionHero";
import StylishStore from "@/components/themes/StylishStore";
import LuxuryStore from "@/components/themes/LuxuryStore";
import EditorialStore from "@/components/themes/EditorialStore";
import VibrantStore from "@/components/themes/VibrantStore";
import TechStore from "@/components/themes/TechStore";
import SportStore from "@/components/themes/SportStore";
import GamingStore from "@/components/themes/GamingStore";
import BoutiqueStore from "@/components/themes/BoutiqueStore";
import AuroraStore from "@/components/themes/AuroraStore";
import CinematicStore from "@/components/themes/CinematicStore";
import AppleStore from "@/components/themes/AppleStore";
import { useStoreTemplate } from "@/hooks/useStoreTemplate";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  original_price: number | null;
  images: string[];
}

interface StoreSettings {
  currency_symbol: string;
}

const StoreFront = () => {
  const { username } = useParams<{ username?: string }>();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const template = useStoreTemplate(ownerId);
  const [notFound, setNotFound] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({ currency_symbol: 'د.ل' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      let resolvedOwnerId: string | null = null;
      let resolvedStoreId: string | null = null;

      if (username) {
        // Try store slug first (multi-store routing)
        const { data: store } = await supabase
          .from("stores").select("id, owner_id")
          .eq("slug", username).maybeSingle();
        if (cancelled) return;
        if (store) {
          resolvedOwnerId = store.owner_id;
          resolvedStoreId = store.id;
          setOwnerId(store.owner_id);
          setStoreId(store.id);
        } else {
          const { data: prof } = await supabase
          .from("profiles").select("user_id, is_active")
          .eq("username", username).maybeSingle();
          if (cancelled) return;
          if (!prof || !prof.is_active) { setNotFound(true); setLoading(false); return; }
          resolvedOwnerId = prof.user_id;
          setOwnerId(prof.user_id);
        }
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (user) { resolvedOwnerId = user.id; setOwnerId(user.id); }
      }

      // Single query: get everything (including images) in one round-trip
      const productsQuery = supabase
        .from('products')
        .select('id, name, slug, price, original_price, images')
        .eq('is_visible', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (resolvedOwnerId) productsQuery.eq('owner_id', resolvedOwnerId);
      if (resolvedStoreId) productsQuery.eq('store_id', resolvedStoreId);

      const settingsQuery = supabase
        .from('store_settings').select('currency_symbol').limit(1);
      if (resolvedOwnerId) settingsQuery.eq('owner_id', resolvedOwnerId);

      const [productsRes, settingsRes] = await Promise.all([
        productsQuery,
        settingsQuery.maybeSingle(),
      ]);
      if (cancelled) return;

      if (productsRes.data) {
        setProducts(productsRes.data.map((p: any) => ({ ...p, images: p.images || [] })));
      }
      if (settingsRes.data) setStoreSettings({ currency_symbol: settingsRes.data.currency_symbol });
      setLoading(false);
    };

    fetchData();
    return () => { cancelled = true; };
  }, [username]);


  const openProductPage = (slug: string) => {
    const path = username ? `/p/${username}/${slug}` : `/p/${slug}`;
    window.open(path, '_blank');
  };

  if (notFound) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Full-page themes replace the entire store page (with their own header/footer)
  const fullPageThemes = ["stylish", "luxury", "editorial", "vibrant", "tech", "sport", "gaming", "boutique", "noirGold", "emeraldGold", "midnightSapphire", "roseAmethyst", "aurora", "cinematic", "apple"] as const;
  if ((fullPageThemes as readonly string[]).includes(template)) {
    const commonProps = { products, currencySymbol: storeSettings.currency_symbol, onOpenProduct: openProductPage, ownerId };
    return (
      <div dir="rtl" className="bg-white min-h-screen -mx-4 -my-6">
        {template === "stylish" && <StylishStore {...commonProps} />}
        {template === "luxury" && <LuxuryStore {...commonProps} />}
        {template === "editorial" && <EditorialStore {...commonProps} />}
        {template === "vibrant" && <VibrantStore {...commonProps} />}
        {template === "tech" && <TechStore {...commonProps} />}
        {template === "sport" && <SportStore {...commonProps} />}
        {template === "gaming" && <GamingStore {...commonProps} />}
        {template === "boutique" && <BoutiqueStore {...commonProps} />}
        {(template === "noirGold" || template === "emeraldGold" || template === "midnightSapphire" || template === "roseAmethyst") && <LuxuryStore {...commonProps} />}
        {template === "aurora" && <AuroraStore {...commonProps} />}
        {template === "cinematic" && <CinematicStore {...commonProps} />}
        {template === "apple" && <AppleStore {...commonProps} />}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in container mx-auto px-4 py-6" dir="rtl">
      <StoreHeader ownerId={ownerId || undefined} />

      {template === "fashion" && products.length > 0 && (
        <div className="-mx-4">
          <FashionHero
            title="مجموعة الموسم"
            subtitle="عروض حصرية"
            description="اكتشف أحدث المنتجات بأسعار مميّزة. الدفع عند الاستلام وشحن لكل ليبيا."
            imageUrl={products[0]?.images?.[0]}
            primaryCtaText="تسوّق الآن"
            onPrimaryCta={() => {
              document.getElementById("products-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            sideTextRight="LIBYA STORE"
            sideTextLeft="الموسم الجديد"
          />
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg">لا توجد منتجات حالياً</p>
        </div>
      ) : (
        <div id="products-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <Card
              key={product.id}
              className="group overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer border-border"
              onClick={() => openProductPage(product.slug)}
            >
              <div className="aspect-square relative overflow-hidden bg-muted">
                {product.images && product.images.length > 0 ? (
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-16 h-16 text-muted-foreground" /></div>
                )}
                {product.original_price && product.original_price > product.price && (
                  <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded">
                    خصم {Math.round(((product.original_price - product.price) / product.original_price) * 100)}%
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-foreground text-lg line-clamp-2 group-hover:text-primary transition-colors">{product.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-primary">{product.price} {storeSettings.currency_symbol}</span>
                  {product.original_price && product.original_price > product.price && (
                    <span className="text-sm text-muted-foreground line-through">{product.original_price} {storeSettings.currency_symbol}</span>
                  )}
                </div>
                <Button className="w-full gap-2" onClick={(e) => { e.stopPropagation(); openProductPage(product.slug); }}>
                  <ExternalLink className="w-4 h-4" /> عرض المنتج
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StoreFront;
