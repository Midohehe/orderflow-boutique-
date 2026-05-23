import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Star, ShoppingBag, ChevronDown } from "lucide-react";
import type { HomeSectionRow } from "@/lib/homeSections";

interface Props {
  section: HomeSectionRow;
  ownerId: string;
  storeId: string;
  username?: string;
  currencySymbol: string;
}

export const SectionRenderer = ({ section, ownerId, storeId, username, currencySymbol }: Props) => {
  const c = section.config || {};
  switch (section.section_type) {
    case "hero":
      return (
        <section
          className="relative w-full rounded-xl overflow-hidden min-h-[280px] sm:min-h-[420px] flex items-center justify-center my-4"
          style={{
            backgroundImage: c.image ? `url(${c.image})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: c.image ? undefined : "hsl(var(--muted))",
          }}
        >
          {c.image && (
            <div
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(0,0,0,${c.overlay ?? 0.4})` }}
            />
          )}
          <div className="relative z-10 text-center px-6 py-12 max-w-3xl" style={{ color: c.text_color || "#fff" }}>
            {c.title && <h2 className="text-3xl sm:text-5xl font-extrabold mb-3 drop-shadow">{c.title}</h2>}
            {c.subtitle && <p className="text-lg sm:text-xl mb-6 opacity-95 drop-shadow">{c.subtitle}</p>}
            {c.button_text && (
              <a href={c.button_link || "#"}>
                <Button size="lg" className="font-bold">{c.button_text}</Button>
              </a>
            )}
          </div>
        </section>
      );

    case "banner":
      return c.image ? (
        <a href={c.link || "#"} className="block my-4">
          <img src={c.image} alt={c.alt || ""} className="w-full h-auto rounded-xl" />
        </a>
      ) : null;

    case "products_grid":
      return <ProductsGridSection ownerId={ownerId} storeId={storeId} username={username} config={c} currencySymbol={currencySymbol} />;

    case "categories_grid":
      return (
        <section className="my-6">
          {c.title && <h2 className="text-2xl font-bold text-center mb-5">{c.title}</h2>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {(c.items || []).map((it: any, i: number) => (
              <a key={i} href={it.link || "#"} className="group">
                <div className="aspect-square rounded-full overflow-hidden bg-muted border-2 border-border group-hover:border-primary transition">
                  {it.image && <img src={it.image} alt={it.label} className="w-full h-full object-cover group-hover:scale-105 transition" />}
                </div>
                <p className="text-center mt-2 font-medium text-sm">{it.label}</p>
              </a>
            ))}
          </div>
        </section>
      );

    case "rich_text":
      return (
        <section className="my-6 prose prose-sm md:prose-base max-w-none dark:prose-invert" style={{ textAlign: c.align || "center" }}>
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c.html || "") }} />
        </section>
      );

    case "video": {
      const url = c.url || "";
      const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
      const embed = yt ? `https://www.youtube.com/embed/${yt[1]}` : url;
      return (
        <section className="my-6">
          {c.title && <h2 className="text-2xl font-bold text-center mb-4">{c.title}</h2>}
          {url && (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
              <iframe src={embed} className="absolute inset-0 w-full h-full" allowFullScreen title={c.title || "video"} />
            </div>
          )}
        </section>
      );
    }

    case "faq":
      return (
        <section className="my-6 max-w-3xl mx-auto">
          {c.title && <h2 className="text-2xl font-bold text-center mb-5">{c.title}</h2>}
          <div className="space-y-2">
            {(c.items || []).map((it: any, i: number) => (
              <FaqItem key={i} q={it.q} a={it.a} />
            ))}
          </div>
        </section>
      );

    case "features":
      return (
        <section className="my-6">
          {c.title && <h2 className="text-2xl font-bold text-center mb-6">{c.title}</h2>}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(c.items || []).map((it: any, i: number) => (
              <Card key={i} className="text-center">
                <CardContent className="p-5">
                  <div className="text-4xl mb-3">{it.icon || "✨"}</div>
                  <h3 className="font-bold mb-1">{it.title}</h3>
                  <p className="text-sm text-muted-foreground">{it.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      );

    case "promo_bar":
      return (
        <div
          className="w-full text-center py-3 px-4 rounded-lg my-3 font-semibold"
          style={{ background: c.bg || "#7c3aed", color: c.color || "#fff" }}
        >
          {c.text}
        </div>
      );

    case "reviews":
      return (
        <section className="my-6">
          {c.title && <h2 className="text-2xl font-bold text-center mb-5">{c.title}</h2>}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(c.items || []).map((it: any, i: number) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex gap-0.5 mb-2">
                    {Array.from({ length: it.rating || 5 }).map((_, k) => (
                      <Star key={k} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm mb-3 italic">"{it.text}"</p>
                  <p className="font-bold text-sm">— {it.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      );

    default:
      return null;
  }
};

const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-right hover:bg-muted/50 transition"
      >
        <span className="font-semibold">{q}</span>
        <ChevronDown className={`w-5 h-5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="p-4 pt-0 text-muted-foreground text-sm">{a}</div>}
    </div>
  );
};

const ProductsGridSection = ({
  ownerId, storeId, username, config, currencySymbol,
}: { ownerId: string; storeId: string; username?: string; config: any; currencySymbol: string }) => {
  const [products, setProducts] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("products")
      .select("id, name, slug, price, original_price, images")
      .eq("owner_id", ownerId)
      .eq("store_id", storeId)
      .eq("is_visible", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(config.limit || 8)
      .then(({ data }) => { if (!cancelled && data) setProducts(data); });
    return () => { cancelled = true; };
  }, [ownerId, storeId, config.limit]);

  const cols = config.columns || 4;
  const gridCls = cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-2 md:grid-cols-3" : "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <section className="my-6" id="products">
      {config.title && <h2 className="text-2xl font-bold text-center mb-5">{config.title}</h2>}
      <div className={`grid grid-cols-1 ${gridCls} gap-4`}>
        {products.map((p) => (
          <a
            key={p.id}
            href={username ? `/p/${username}/${p.slug}` : `/p/${p.slug}`}
            target="_blank"
            rel="noopener"
          >
            <Card className="group overflow-hidden hover:shadow-lg transition cursor-pointer">
              <div className="aspect-square bg-muted overflow-hidden">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-12 h-12 text-muted-foreground" /></div>
                )}
              </div>
              <CardContent className="p-3 space-y-2">
                <h3 className="font-semibold line-clamp-2 text-sm">{p.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">{p.price} {currencySymbol}</span>
                  {p.original_price && p.original_price > p.price && (
                    <span className="text-xs text-muted-foreground line-through">{p.original_price}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </section>
  );
};