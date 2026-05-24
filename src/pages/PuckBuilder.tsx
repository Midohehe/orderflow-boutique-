import { useEffect, useMemo, useState } from "react";
import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { supabase } from "@/integrations/supabase/client";
import { useStoreContext } from "@/hooks/useStoreContext";
import { useUserContext } from "@/hooks/useUserContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Eye, Loader2, ArrowLeft } from "lucide-react";
import { buildPuckConfig, EMPTY_PUCK_DATA, LANDING_PAGE_STARTER_PUCK_DATA, type PuckContext } from "@/lib/puck/config";
import { useNavigate, useSearchParams } from "react-router-dom";

const PuckBuilder = () => {
  const { activeStore } = useStoreContext();
  const { profile } = useUserContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const landingId = searchParams.get("landing");
  const templateId = searchParams.get("template");
  const isLandingMode = !!landingId;
  const isTemplateMode = !!templateId;
  const storeId = activeStore?.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rowId, setRowId] = useState<string | null>(null);
  const [landingMeta, setLandingMeta] = useState<{ slug: string; title: string } | null>(null);
  const [templateName, setTemplateName] = useState<string>("");

  const ctx: PuckContext = useMemo(() => ({
    ownerId: activeStore?.owner_id || profile?.user_id,
    storeId,
    username: activeStore?.slug,
    currencySymbol: "د.ل",
  }), [activeStore, profile, storeId]);

  const config = useMemo(() => buildPuckConfig(ctx), [ctx]);

  useEffect(() => {
    setLoading(true);
    if (isTemplateMode && templateId) {
      (supabase as any).from("landing_page_templates")
        .select("id, name, puck_data")
        .eq("id", templateId)
        .maybeSingle()
        .then(({ data: row }: any) => {
          if (row) {
            setRowId(row.id);
            setTemplateName(row.name || "");
            const hasData = row.puck_data && Array.isArray(row.puck_data?.content) && row.puck_data.content.length > 0;
            setData(hasData ? row.puck_data : LANDING_PAGE_STARTER_PUCK_DATA);
          } else {
            setData(LANDING_PAGE_STARTER_PUCK_DATA);
          }
          setLoading(false);
        });
      return;
    }
    if (isLandingMode && landingId) {
      supabase.from("landing_pages")
        .select("id, slug, title, puck_data")
        .eq("id", landingId)
        .maybeSingle()
        .then(({ data: row }: any) => {
          if (row) {
            setRowId(row.id);
            setLandingMeta({ slug: row.slug, title: row.title || "" });
            setData((row as any).puck_data || EMPTY_PUCK_DATA);
          } else {
            setData(EMPTY_PUCK_DATA);
          }
          setLoading(false);
        });
      return;
    }
    if (!storeId) return;
    supabase.from("store_page_layouts" as any)
      .select("*").eq("store_id", storeId).eq("page_key", "home").maybeSingle()
      .then(({ data: row }: any) => {
        if (row) { setRowId(row.id); setData(row.puck_data || EMPTY_PUCK_DATA); }
        else { setData(EMPTY_PUCK_DATA); }
        setLoading(false);
      });
  }, [storeId, isLandingMode, landingId, isTemplateMode, templateId]);

  const save = async (puckData: any, publish: boolean) => {
    if (isTemplateMode) {
      if (!rowId) { toast({ title: "خطأ", description: "القالب غير موجود", variant: "destructive" }); return; }
      const { error } = await (supabase as any).from("landing_page_templates")
        .update({ puck_data: puckData })
        .eq("id", rowId);
      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
      toast({ title: publish ? "تم الحفظ ✓" : "تم الحفظ" });
      return;
    }
    if (isLandingMode) {
      if (!rowId) { toast({ title: "خطأ", description: "صفحة الهبوط غير موجودة", variant: "destructive" }); return; }
      const { error } = await supabase.from("landing_pages")
        .update({ puck_data: puckData } as any)
        .eq("id", rowId);
      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
      toast({ title: publish ? "تم النشر ✓" : "تم الحفظ" });
      return;
    }
    if (!storeId) return;
    const payload: any = {
      store_id: storeId,
      owner_id: activeStore?.owner_id || profile?.user_id,
      page_key: "home",
      puck_data: puckData,
      ...(publish ? { is_published: true } : {}),
    };
    let res;
    if (rowId) {
      res = await supabase.from("store_page_layouts" as any).update(payload).eq("id", rowId).select().single();
    } else {
      res = await supabase.from("store_page_layouts" as any).insert(payload).select().single();
      if (res.data) setRowId((res.data as any).id);
    }
    if (res.error) { toast({ title: "خطأ", description: res.error.message, variant: "destructive" }); return; }
    toast({ title: publish ? "تم النشر ✓" : "تم الحفظ" });
  };

  if (loading || !data) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  const previewUrl = isLandingMode && landingMeta
    ? `/p/${activeStore?.slug || ""}/${landingMeta.slug}`
    : `/store/${activeStore?.slug || ""}`;
  const headerTitle = isTemplateMode
    ? `محرر القالب — ${templateName}`
    : isLandingMode
    ? `محرر صفحة الهبوط — ${landingMeta?.title || landingMeta?.slug || ""}`
    : `محرر الصفحة الرئيسية — ${activeStore?.name || ""}`;

  return (
    <div className="fixed inset-0 z-50 bg-background" dir="ltr">
      <div className="h-12 border-b bg-card flex items-center justify-between px-4" dir="rtl">
        <Button variant="ghost" size="sm" onClick={() => navigate(isTemplateMode ? "/dashboard/landing-templates" : isLandingMode ? "/dashboard/products" : "/dashboard")}>
          <ArrowLeft className="w-4 h-4 ml-1" /> رجوع
        </Button>
        <span className="font-bold">{headerTitle}</span>
        <Button size="sm" variant="outline" onClick={() => !isTemplateMode && window.open(previewUrl, "_blank")} disabled={isTemplateMode}>
          <Eye className="w-4 h-4 ml-1" /> معاينة
        </Button>
      </div>
      <div className="h-[calc(100vh-3rem)]">
        <Puck
          config={config as any}
          data={data}
          onPublish={(d) => save(d, true)}
          headerTitle="بناء الصفحة"
          overrides={{
            headerActions: ({ children }) => (
              <>
                <Button size="sm" variant="outline" onClick={async () => {
                  toast({ title: "اضغط Publish للحفظ والنشر" });
                }}>حفظ</Button>
                {children}
              </>
            ),
          }}
        />
      </div>
    </div>
  );
};

export default PuckBuilder;