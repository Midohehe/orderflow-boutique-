import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Mail, Instagram, Facebook, Music2, MessageCircle, ShoppingBag, Search, Heart } from "lucide-react";

export interface HeaderSettings {
  logo_text: string;
  logo_image: string | null;
  tagline: string | null;
  phone: string | null;
  email: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  whatsapp_url: string | null;
  tiktok_url: string | null;
}

const DEFAULTS: HeaderSettings = {
  logo_text: "",
  logo_image: null,
  tagline: "",
  phone: "",
  email: "",
  instagram_url: "",
  facebook_url: "",
  whatsapp_url: "",
  tiktok_url: "",
};

interface StoreHeaderProps {
  ownerId?: string;
  storeId?: string;
  variant?: "default" | "fashion";
  themePreset?: string | null;
  /**
   * Pre-resolved header settings (e.g. from the landing-page SSR seed). When
   * provided, the component renders from these immediately.
   */
  initialSettings?: HeaderSettings | null;
  /**
   * When true, the settings are considered fully seeded (even if empty/null) and
   * the component skips its own header_settings query — avoiding a DB read on
   * every landing-page visit.
   */
  seeded?: boolean;
}

const FASHION_NAV_MENS = [
  { href: "#products", label: "تسوق" },
  { href: "#products", label: "التشكيلات" },
  { href: "#editorial", label: "افتتاحية" },
  { href: "#editorial", label: "من نحن" },
];

const FASHION_NAV_DEFAULT = [
  { href: "#products", label: "تسوق" },
  { href: "#editorial", label: "المجموعات" },
  { href: "#products", label: "وصل حديثاً" },
  { href: "#editorial", label: "من نحن" },
];

const StoreHeader = ({ ownerId, storeId, variant = "default", themePreset, initialSettings, seeded }: StoreHeaderProps = {}) => {
  const [settings, setSettings] = useState<HeaderSettings>(initialSettings ?? DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    if (!ownerId) return;
    // Seeded from SSR — already have the settings (even if empty), skip the read.
    if (seeded) return;
    let q = supabase
      .from("header_settings")
      .select("logo_text, logo_image, tagline, phone, email, instagram_url, facebook_url, whatsapp_url, tiktok_url, owner_id")
      .eq("owner_id", ownerId);
    if (storeId) q = q.eq("store_id", storeId);
    q.limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setSettings(data as HeaderSettings);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId, storeId, seeded]);

  const hasContact = settings.phone || settings.email;
  const hasSocial =
    settings.instagram_url || settings.facebook_url || settings.whatsapp_url || settings.tiktok_url;
  const brandName = settings.logo_text || "متجرنا";
  const brandInitial = brandName.trim().charAt(0) || "م";

  if (variant === "fashion") {
    const navLinks = themePreset === "aura-mens-store" ? FASHION_NAV_MENS : FASHION_NAV_DEFAULT;
    return (
      <header className="fashion-store-header w-full mb-0" dir="rtl">
        <div className="container mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {settings.logo_image ? (
              <img src={settings.logo_image} alt={brandName} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-lg shrink-0">
                {brandInitial}
              </div>
            )}
            <span className="text-xl md:text-2xl font-black tracking-tight truncate">{brandName}</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 font-bold text-sm">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="hover:text-primary transition-colors">{link.label}</a>
            ))}
          </nav>

          <div className="flex items-center gap-4 md:gap-6 shrink-0">
            <button type="button" className="hover:text-primary transition-colors" aria-label="بحث">
              <Search className="w-5 h-5" />
            </button>
            <button type="button" className="hover:text-primary transition-colors hidden sm:inline-flex" aria-label="المفضلة">
              <Heart className="w-5 h-5" />
            </button>
            <a href="#products" className="relative hover:text-primary transition-colors" aria-label="السلة">
              <ShoppingBag className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="w-full bg-gradient-to-l from-primary/10 via-background to-primary/5 border-b border-border mb-6 rounded-lg overflow-hidden" dir="rtl">
      {(hasContact || hasSocial) && (
        <div className="bg-foreground/95 text-background text-xs sm:text-sm">
          <div className="container mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              {settings.phone && (
                <a href={`tel:${settings.phone}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Phone className="w-3.5 h-3.5" />
                  <span dir="ltr">{settings.phone}</span>
                </a>
              )}
              {settings.email && (
                <a href={`mailto:${settings.email}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Mail className="w-3.5 h-3.5" />
                  <span dir="ltr">{settings.email}</span>
                </a>
              )}
            </div>
            {hasSocial && (
              <div className="flex items-center gap-3">
                {[
                  { url: settings.instagram_url, Icon: Instagram, label: "Instagram" },
                  { url: settings.facebook_url, Icon: Facebook, label: "Facebook" },
                  { url: settings.tiktok_url, Icon: Music2, label: "TikTok" },
                  { url: settings.whatsapp_url, Icon: MessageCircle, label: "WhatsApp" },
                ].filter(s => s.url).map(({ url, Icon, label }) => (
                  <a
                    key={label}
                    href={url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="hover:text-primary transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      try {
                        (window.top || window).open(url!, "_blank", "noopener,noreferrer");
                      } catch {
                        window.open(url!, "_blank", "noopener,noreferrer");
                      }
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {settings.logo_image && (
            <img
              src={settings.logo_image}
              alt={settings.logo_text}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-primary/30"
              loading="eager"
            />
          )}
          <div className="text-center sm:text-right">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {settings.logo_text}
            </h1>
            {settings.tagline && (
              <p className="text-sm sm:text-base text-muted-foreground mt-1">{settings.tagline}</p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default StoreHeader;
