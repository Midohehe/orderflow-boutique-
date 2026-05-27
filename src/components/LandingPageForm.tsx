import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import ImageUpload from "@/components/ImageUpload";
import RichTextEditor from "@/components/RichTextEditor";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Tag, FileText, ImageIcon, DollarSign, TrendingUp, Eye, Package, HelpCircle, Trash2, LayoutTemplate, Ruler, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const SectionCard = ({
  icon: Icon,
  title,
  description,
  iconColor = "bg-blue-500",
  children,
}: {
  icon: any;
  title: string;
  description?: string;
  iconColor?: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
    <div className="flex items-start gap-3 px-4 py-3 border-b bg-muted/40">
      <div className={`w-9 h-9 rounded-lg ${iconColor} text-white flex items-center justify-center shadow-sm shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-foreground leading-tight">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
    <div className="p-4 space-y-4">{children}</div>
  </div>
);

export interface LandingPageFormData {
  productId: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  images: string[];
  price: string;
  originalPrice: string;
  upsellEnabled: boolean;
  upsellTitle?: string;
  upsellOffers: Array<{ quantity: string; price: string; label: string }>;
  orderFormOnTop?: boolean;
  showQuantity?: boolean;
  isVisible: boolean;
  faqs?: Array<{ question: string; answer: string }>;
  templateId?: string;
  sizeChart?: {
    enabled: boolean;
    title?: string;
    description?: string;
    columns: string[];
    rows: Array<{ enabled: boolean; values: string[]; note?: string }>;
  };
}

export const emptyLandingPageData: LandingPageFormData = {
  productId: "",
  slug: "",
  title: "",
  subtitle: "",
  description: "",
  images: [],
  price: "",
  originalPrice: "",
  upsellEnabled: false,
  upsellTitle: "",
  upsellOffers: [],
  orderFormOnTop: false,
  showQuantity: true,
  isVisible: true,
  faqs: [],
  templateId: "",
  sizeChart: {
    enabled: false,
    title: "جدول المقاسات",
    description: "",
    columns: ["المقاس", "الطول (سم)", "العرض (سم)"],
    rows: [],
  },
};

interface ProductOption {
  id: string;
  name: string;
  price: string;
  original_price?: string;
  images: string[];
}

interface LandingPageFormProps {
  data: LandingPageFormData;
  onChange: (d: LandingPageFormData) => void;
  onSubmit: () => void;
  submitText: string;
  isLoading?: boolean;
  products: ProductOption[];
  /** عند التعديل: لا نسمح بتغيير المنتج المرتبط */
  lockProduct?: boolean;
  templates?: Array<{ id: string; name: string; is_default?: boolean }>;
}

const LandingPageForm = ({ data, onChange, onSubmit, submitText, isLoading, products, lockProduct, templates }: LandingPageFormProps) => {
  const update = <K extends keyof LandingPageFormData>(field: K, value: LandingPageFormData[K]) => {
    onChange({ ...data, [field]: value });
  };

  const selectedProduct = products.find((p) => p.id === data.productId);

  return (
    <div className="space-y-5 mt-4">
      {/* اختيار المنتج */}
      <SectionCard icon={Package} title="المنتج المرتبط" description="اختر المنتج الذي ستعرضه هذه الصفحة" iconColor="bg-blue-500">
        {lockProduct ? (
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
            {selectedProduct?.images?.[0] && (
              <img src={selectedProduct.images[0]} alt="" className="w-12 h-12 object-cover rounded" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{selectedProduct?.name || "—"}</div>
              <div className="text-xs text-muted-foreground">لا يمكن تغيير المنتج المرتبط بعد الإنشاء</div>
            </div>
          </div>
        ) : (
          <>
            <SearchableSelect
              value={data.productId || "__none__"}
              onChange={(v) => update("productId", v === "__none__" ? "" : v)}
              placeholder="ابحث واختر المنتج..."
              searchPlaceholder="ابحث بالاسم..."
              options={[
                { value: "__none__", label: "— لم يُختر بعد —" },
                ...products.map((p) => ({
                  value: p.id,
                  label: p.name,
                  keywords: p.name,
                })),
              ]}
            />
            {selectedProduct && (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30 mt-2">
                {selectedProduct.images?.[0] && (
                  <img src={selectedProduct.images[0]} alt="" className="w-12 h-12 object-cover rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{selectedProduct.name}</div>
                  <div className="text-xs text-muted-foreground">السعر الافتراضي: {selectedProduct.price}</div>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* المعلومات الأساسية */}
      <SectionCard icon={Tag} title="المعلومات الأساسية" description="عنوان الصفحة والرابط" iconColor="bg-indigo-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">العنوان <span className="text-red-500">*</span></Label>
            <Input
              value={data.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="عنوان جذاب لصفحة الهبوط"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">الرابط (slug) <span className="text-red-500">*</span></Label>
            <Input
              value={data.slug}
              onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
              placeholder="my-offer"
              dir="ltr"
              className="text-left font-mono"
            />
            <p className="text-xs text-muted-foreground">/p/{data.slug || "my-offer"}</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="font-semibold">العنوان الفرعي</Label>
          <Input
            value={data.subtitle}
            onChange={(e) => update("subtitle", e.target.value)}
            placeholder="جملة قصيرة تشرح العرض"
          />
        </div>
      </SectionCard>

      {/* الصور */}
      <SectionCard
        icon={ImageIcon}
        title="صور صفحة الهبوط"
        description="صور خاصة بهذه الصفحة (اختياري — افتراضيًا تستخدم صور المنتج)"
        iconColor="bg-purple-500"
      >
        <ImageUpload
          images={data.images}
          onImagesChange={(images) => update("images", images)}
          maxImages={5}
        />
      </SectionCard>

      {/* التسعير */}
      <SectionCard icon={DollarSign} title="التسعير" description="اتركه فارغًا لاستخدام سعر المنتج" iconColor="bg-emerald-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">سعر العرض</Label>
            <Input
              type="number"
              value={data.price}
              onChange={(e) => update("price", e.target.value)}
              placeholder={selectedProduct ? selectedProduct.price : "99"}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">السعر قبل الخصم</Label>
            <Input
              type="number"
              value={data.originalPrice}
              onChange={(e) => update("originalPrice", e.target.value)}
              placeholder={selectedProduct?.original_price || "149"}
            />
          </div>
        </div>
      </SectionCard>

      {/* الوصف الثري */}
      <SectionCard icon={FileText} title="وصف الصفحة" description="محتوى منسق مع صور وفيديوهات" iconColor="bg-amber-500">
        <RichTextEditor
          value={data.description}
          onChange={(value) => update("description", value)}
          placeholder="اكتب محتوى صفحة الهبوط..."
        />
      </SectionCard>

      {/* Upsell */}
      <SectionCard icon={TrendingUp} title="عروض Upsell" description="عروض كميات بأسعار خاصة" iconColor="bg-orange-500">
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border-2 border-dashed bg-muted/40">
          <div className="flex-1 min-w-0">
            <Label className="block font-semibold">تفعيل العروض</Label>
            <p className="text-xs text-muted-foreground mt-1">مثال: اشترِ 4 قطع بسعر 320 + شحن مجاني</p>
          </div>
          <Switch checked={!!data.upsellEnabled} onCheckedChange={(v) => update("upsellEnabled", v)} />
        </div>

        {data.upsellEnabled && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">عنوان قسم العروض (يظهر للمشتري)</Label>
              <Input
                value={data.upsellTitle ?? ""}
                onChange={(e) => update("upsellTitle", e.target.value)}
                placeholder="🎁 عروض خاصة"
              />
            </div>
            {(data.upsellOffers || []).map((offer, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-[6rem_8rem_1fr_auto] gap-2 p-3 border rounded-lg bg-muted/20 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">عدد القطع</Label>
                  <Input
                    type="number"
                    min="1"
                    value={offer.quantity}
                    onChange={(e) => {
                      const next = [...data.upsellOffers];
                      next[idx] = { ...next[idx], quantity: e.target.value };
                      update("upsellOffers", next);
                    }}
                    placeholder="4"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">السعر الإجمالي</Label>
                  <Input
                    type="number"
                    min="0"
                    value={offer.price}
                    onChange={(e) => {
                      const next = [...data.upsellOffers];
                      next[idx] = { ...next[idx], price: e.target.value };
                      update("upsellOffers", next);
                    }}
                    placeholder="320"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الوصف الظاهر</Label>
                  <Input
                    value={offer.label}
                    onChange={(e) => {
                      const next = [...data.upsellOffers];
                      next[idx] = { ...next[idx], label: e.target.value };
                      update("upsellOffers", next);
                    }}
                    placeholder="اشترِ 4 قطع بسعر 320"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const next = data.upsellOffers.filter((_, i) => i !== idx);
                    update("upsellOffers", next);
                  }}
                >
                  حذف
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              className="bg-blue-500 hover:bg-blue-600 text-white"
              onClick={() =>
                update("upsellOffers", [
                  ...(data.upsellOffers || []),
                  { quantity: "", price: "", label: "" },
                ])
              }
            >
              + إضافة عرض
            </Button>
          </div>
        )}
      </SectionCard>

      {/* جدول المقاسات */}
      <SectionCard
        icon={Ruler}
        title="جدول المقاسات"
        description="جدول احترافي بأعمدة وصفوف قابلة للتفعيل والتحرير"
        iconColor="bg-fuchsia-500"
      >
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border-2 border-dashed bg-muted/40">
          <div className="flex-1 min-w-0">
            <Label className="block font-semibold">تفعيل جدول المقاسات</Label>
            <p className="text-xs text-muted-foreground mt-1">عند الإيقاف لن يظهر الجدول في صفحة الهبوط</p>
          </div>
          <Switch
            checked={!!data.sizeChart?.enabled}
            onCheckedChange={(v) =>
              update("sizeChart", {
                enabled: v,
                title: data.sizeChart?.title ?? "جدول المقاسات",
                description: data.sizeChart?.description ?? "",
                columns: data.sizeChart?.columns?.length ? data.sizeChart.columns : ["المقاس", "الطول (سم)", "العرض (سم)"],
                rows: data.sizeChart?.rows ?? [],
              })
            }
          />
        </div>

        {data.sizeChart?.enabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">عنوان الجدول</Label>
                <Input
                  value={data.sizeChart.title ?? ""}
                  onChange={(e) => update("sizeChart", { ...data.sizeChart!, title: e.target.value })}
                  placeholder="جدول المقاسات"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">وصف مختصر (اختياري)</Label>
                <Input
                  value={data.sizeChart.description ?? ""}
                  onChange={(e) => update("sizeChart", { ...data.sizeChart!, description: e.target.value })}
                  placeholder="اختر المقاس المناسب وفقًا للجدول"
                />
              </div>
            </div>

            {/* الأعمدة */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">الأعمدة</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const sc = data.sizeChart!;
                    const columns = [...sc.columns, ""];
                    const rows = sc.rows.map((r) => ({ ...r, values: [...r.values, ""] }));
                    update("sizeChart", { ...sc, columns, rows });
                  }}
                >
                  <Plus className="w-4 h-4" /> عمود
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {data.sizeChart.columns.map((col, ci) => (
                  <div key={ci} className="flex items-center gap-1">
                    <Input
                      value={col}
                      onChange={(e) => {
                        const sc = data.sizeChart!;
                        const columns = [...sc.columns];
                        columns[ci] = e.target.value;
                        update("sizeChart", { ...sc, columns });
                      }}
                      placeholder={`عمود ${ci + 1}`}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 shrink-0 text-red-500"
                      onClick={() => {
                        const sc = data.sizeChart!;
                        const columns = sc.columns.filter((_, i) => i !== ci);
                        const rows = sc.rows.map((r) => ({ ...r, values: r.values.filter((_, i) => i !== ci) }));
                        update("sizeChart", { ...sc, columns, rows });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* الصفوف */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">الصفوف (المقاسات)</Label>
                <Button
                  type="button"
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={() => {
                    const sc = data.sizeChart!;
                    update("sizeChart", {
                      ...sc,
                      rows: [...sc.rows, { enabled: true, values: sc.columns.map(() => ""), note: "" }],
                    });
                  }}
                >
                  <Plus className="w-4 h-4" /> إضافة مقاس
                </Button>
              </div>

              {data.sizeChart.rows.length === 0 && (
                <div className="text-xs text-muted-foreground p-4 text-center border rounded-lg border-dashed">
                  لا توجد مقاسات بعد — اضغط "إضافة مقاس"
                </div>
              )}

              {data.sizeChart.rows.map((row, ri) => (
                <div key={ri} className="p-3 border rounded-lg bg-muted/20 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-2 text-xs font-semibold">
                      <Switch
                        checked={row.enabled}
                        onCheckedChange={(v) => {
                          const sc = data.sizeChart!;
                          const rows = [...sc.rows];
                          rows[ri] = { ...row, enabled: v };
                          update("sizeChart", { ...sc, rows });
                        }}
                      />
                      {row.enabled ? "ظاهر" : "مخفي"}
                    </label>
                    <div className="flex-1" />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      disabled={ri === 0}
                      onClick={() => {
                        const sc = data.sizeChart!;
                        const rows = [...sc.rows];
                        [rows[ri - 1], rows[ri]] = [rows[ri], rows[ri - 1]];
                        update("sizeChart", { ...sc, rows });
                      }}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      disabled={ri === data.sizeChart!.rows.length - 1}
                      onClick={() => {
                        const sc = data.sizeChart!;
                        const rows = [...sc.rows];
                        [rows[ri + 1], rows[ri]] = [rows[ri], rows[ri + 1]];
                        update("sizeChart", { ...sc, rows });
                      }}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        const sc = data.sizeChart!;
                        update("sizeChart", { ...sc, rows: sc.rows.filter((_, i) => i !== ri) });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {data.sizeChart!.columns.map((col, ci) => (
                      <div key={ci} className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{col || `عمود ${ci + 1}`}</Label>
                        <Input
                          value={row.values[ci] ?? ""}
                          onChange={(e) => {
                            const sc = data.sizeChart!;
                            const rows = [...sc.rows];
                            const values = [...row.values];
                            values[ci] = e.target.value;
                            rows[ri] = { ...row, values };
                            update("sizeChart", { ...sc, rows });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">ملاحظة/وصف (اختياري)</Label>
                    <Input
                      value={row.note ?? ""}
                      onChange={(e) => {
                        const sc = data.sizeChart!;
                        const rows = [...sc.rows];
                        rows[ri] = { ...row, note: e.target.value };
                        update("sizeChart", { ...sc, rows });
                      }}
                      placeholder="مناسب للأطفال من 6-8 سنوات"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* FAQ */}
      <SectionCard icon={HelpCircle} title="الأسئلة الشائعة" description="أسئلة وأجوبة تظهر بشكل قابل للطي" iconColor="bg-cyan-500">
        <div className="space-y-3">
          {(data.faqs || []).map((faq, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 p-3 border rounded-lg bg-muted/20 items-start">
              <div className="space-y-1">
                <Label className="text-xs">السؤال</Label>
                <Input
                  value={faq.question}
                  onChange={(e) => {
                    const next = [...(data.faqs || [])];
                    next[idx] = { ...next[idx], question: e.target.value };
                    update("faqs", next);
                  }}
                  placeholder="هل الدفع عند الاستلام؟"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الجواب</Label>
                <Textarea
                  value={faq.answer}
                  onChange={(e) => {
                    const next = [...(data.faqs || [])];
                    next[idx] = { ...next[idx], answer: e.target.value };
                    update("faqs", next);
                  }}
                  placeholder="نعم، تدفع للمندوب عند استلام طلبك"
                  rows={2}
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  const next = (data.faqs || []).filter((_, i) => i !== idx);
                  update("faqs", next);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 text-white"
            onClick={() =>
              update("faqs", [...(data.faqs || []), { question: "", answer: "" }])
            }
          >
            + إضافة سؤال
          </Button>
        </div>
      </SectionCard>

      {/* قالب التصميم */}
      {templates && templates.length > 0 && (
        <SectionCard
          icon={LayoutTemplate}
          title="قالب التصميم (Puck)"
          description="اختر قالبًا جاهزًا أنشأته من إعدادات المتجر — سيُطبَّق فوق محتوى الصفحة"
          iconColor="bg-violet-500"
        >
          <SearchableSelect
            value={data.templateId || "__none__"}
            onChange={(v) => update("templateId", v === "__none__" ? "" : v)}
            placeholder="اختر قالبًا..."
            searchPlaceholder="ابحث..."
            options={[
              { value: "__none__", label: "— بدون قالب (التصميم الافتراضي) —" },
              ...templates.map((t) => ({
                value: t.id,
                label: t.is_default ? `${t.name} (افتراضي)` : t.name,
                keywords: t.name,
              })),
            ]}
          />
        </SectionCard>
      )}

      {/* الإظهار */}
      <SectionCard icon={Eye} title="الإظهار" iconColor="bg-teal-500">
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30">
          <div className="flex-1 min-w-0">
            <Label className="block font-semibold">صفحة الهبوط مرئية للزوار</Label>
            <p className="text-xs text-muted-foreground mt-1">عند الإيقاف لن يستطيع أحد فتح الرابط</p>
          </div>
          <Switch checked={!!data.isVisible} onCheckedChange={(v) => update("isVisible", v)} />
        </div>
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30">
          <div className="flex-1 min-w-0">
            <Label className="block font-semibold">نموذج الطلب في الأعلى</Label>
            <p className="text-xs text-muted-foreground mt-1">عند التفعيل يظهر نموذج الطلب قبل صور المنتج في بداية الصفحة</p>
          </div>
          <Switch checked={!!data.orderFormOnTop} onCheckedChange={(v) => update("orderFormOnTop", v)} />
        </div>
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30">
          <div className="flex-1 min-w-0">
            <Label className="block font-semibold">إظهار عداد الكمية</Label>
            <p className="text-xs text-muted-foreground mt-1">عند الإيقاف سيختفي عداد +/- القطع من صفحة الهبوط</p>
          </div>
          <Switch checked={data.showQuantity !== false} onCheckedChange={(v) => update("showQuantity", v)} />
        </div>
      </SectionCard>

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur border-t shadow-lg">
        <Button
          onClick={onSubmit}
          className="w-full bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all py-6 text-lg font-bold"
          disabled={isLoading}
        >
          {isLoading ? "جاري الحفظ..." : submitText}
        </Button>
      </div>
    </div>
  );
};

export default LandingPageForm;