import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, ShoppingBag, Phone, MapPin, User } from "lucide-react";
import DOMPurify from "dompurify";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  originalPrice?: string;
  description: string;
  images: string[];
  features: string[];
}

interface LandingPagePreviewProps {
  product: Product;
}

const LandingPagePreview = ({ product }: LandingPagePreviewProps) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
  });

  return (
    <div className="bg-background max-h-[80vh] overflow-y-auto">
      {/* Hero Section */}
      <div className="gradient-primary py-8 px-4 text-center text-primary-foreground">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">{product.name}</h1>
        <div className="flex items-center justify-center gap-2">
          <ShoppingBag className="w-4 h-4" />
          <span>الدفع عند الاستلام</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Product Gallery */}
          <div>
            <div className="aspect-square rounded-xl overflow-hidden bg-muted shadow-lg mb-3">
              <img
                src={product.images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-contain"
              />
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 justify-center">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === index
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img src={image} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Order Form */}
          <div>
            <div className="bg-card rounded-xl p-4 shadow-lg border">
              <div className="text-center mb-4">
                <div className="mb-2">
                  {product.originalPrice && (
                    <span className="text-muted-foreground line-through text-lg ml-2">
                      {product.originalPrice} د.إ
                    </span>
                  )}
                  <span className="text-3xl font-bold text-primary">{product.price} د.إ</span>
                </div>
                <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-3 py-1 rounded-full text-sm">
                  <Check className="w-3 h-3" />
                  <span className="font-medium">متوفر في المخزون</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2 text-sm">
                    <User className="w-3 h-3" />
                    الاسم الكامل *
                  </Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="أدخل اسمك الكامل"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="flex items-center gap-2 text-sm">
                    <Phone className="w-3 h-3" />
                    رقم الهاتف *
                  </Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+971 50 000 0000"
                    type="tel"
                    dir="ltr"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="flex items-center gap-2 text-sm">
                    <MapPin className="w-3 h-3" />
                    المدينة *
                  </Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="دبي"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-sm">العنوان التفصيلي *</Label>
                  <Textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="الشارع، رقم المبنى..."
                    rows={2}
                  />
                </div>

                <Button className="w-full gradient-primary text-primary-foreground py-5 rounded-xl">
                  اطلب الآن - الدفع عند الاستلام
                </Button>

                <p className="text-center text-muted-foreground text-xs">
                  🚚 شحن سريع خلال 2-5 أيام عمل
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <div className="mt-6">
            <h2 className="text-xl font-bold mb-3 text-foreground">وصف المنتج</h2>
            <div
              className="prose prose-sm max-w-none text-foreground [&_img]:rounded-lg [&_img]:max-w-full"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }}
            />
          </div>
        )}

        {/* Features */}
        {product.features && product.features.length > 0 && (
          <div className="mt-6 p-6 bg-muted rounded-xl">
            <h2 className="text-xl font-bold mb-4 text-center text-foreground">المميزات</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {product.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-card rounded-lg"
                >
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-accent" />
                  </div>
                  <span className="text-foreground text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPagePreview;