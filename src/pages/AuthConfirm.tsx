import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function resolveRedirect(type: string, redirectTo: string | null): string {
  if (redirectTo?.startsWith(window.location.origin)) {
    try {
      return new URL(redirectTo).pathname + new URL(redirectTo).search;
    } catch {
      // fall through
    }
  }
  if (type === "recovery") return "/reset-password";
  if (type === "signup" || type === "invite" || type === "magiclink" || type === "email") {
    return "/dashboard";
  }
  return "/login";
}

const AuthConfirm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const redirectTo = searchParams.get("redirect_to");

      if (!tokenHash || !type) {
        if (!cancelled) setError("رابط غير صالح أو منتهي الصلاحية.");
        return;
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      });

      if (cancelled) return;

      if (verifyError) {
        setError(verifyError.message || "تعذّر التحقق من الرابط.");
        return;
      }

      navigate(resolveRedirect(type, redirectTo), { replace: true });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 space-y-4 text-center">
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-sm text-muted-foreground">
              اطلب رابطاً جديداً من صفحة «نسيت كلمة السر» إذا انتهت صلاحية الرابط.
            </p>
            <Button className="w-full" onClick={() => navigate("/login", { replace: true })}>
              العودة لتسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background" dir="rtl">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">جاري التحقق من الرابط…</p>
    </div>
  );
};

export default AuthConfirm;
