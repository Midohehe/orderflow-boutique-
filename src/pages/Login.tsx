import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Mail, Rocket, User, AtSign, CheckCircle2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { clearSavedLogin, loadSavedLogin, saveLogin } from "@/lib/loginRemember";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const signInSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

const signUpSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  username: z
    .string()
    .min(3, "اسم المستخدم 3 أحرف على الأقل")
    .max(30, "اسم المستخدم طويل جداً")
    .regex(/^[a-zA-Z0-9_]+$/, "يسمح بحروف إنجليزية وأرقام و _ فقط"),
  fullName: z.string().min(2, "الاسم الكامل قصير جداً").max(80),
});

const Login = () => {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [systemName, setSystemName] = useState("منصة صلة");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const { user, loading, signIn, signUp } = useAuth();

  useEffect(() => {
    supabase.from("app_settings").select("system_name").limit(1).maybeSingle().then(({ data }) => {
      if (data?.system_name) setSystemName(data.system_name);
    });
  }, []);

  useEffect(() => {
    const saved = loadSavedLogin();
    if (saved) {
      setEmail(saved.email);
      setPassword(saved.password);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      toast({ title: "خطأ في البيانات", description: result.error.errors[0].message, variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        let message = "حدث خطأ أثناء تسجيل الدخول";
        if (error.message.includes("Invalid login credentials")) {
          message = "البريد الإلكتروني أو كلمة المرور غير صحيحة";
        } else if (error.message.toLowerCase().includes("email not confirmed")) {
          message = "يرجى تأكيد بريدك الإلكتروني أولاً عبر الرسالة المرسلة لك";
        }
        toast({ title: "خطأ", description: message, variant: "destructive" });
      } else {
        if (rememberMe) saveLogin(email, password);
        else clearSavedLogin();
        toast({ title: "تم تسجيل الدخول بنجاح", description: "مرحباً بك في لوحة التحكم" });
        navigate("/dashboard");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = signUpSchema.safeParse({ email, password, username, fullName });
    if (!result.success) {
      toast({ title: "خطأ في البيانات", description: result.error.errors[0].message, variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signUp(email, password, username, fullName);
      if (error) {
        let message = "حدث خطأ أثناء إنشاء الحساب";
        const m = error.message.toLowerCase();
        if (m.includes("already registered") || m.includes("user already")) {
          message = "هذا البريد الإلكتروني مسجل مسبقاً";
        } else if (m.includes("weak") || m.includes("pwned") || m.includes("compromised")) {
          message = "كلمة المرور ضعيفة أو مسربة، اختر كلمة مرور أقوى";
        }
        toast({ title: "خطأ", description: message, variant: "destructive" });
      } else {
        setSignupSuccess(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !z.string().email().safeParse(forgotEmail).success) {
      toast({ title: "خطأ", description: "أدخل بريد إلكتروني صالح", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
      } else {
        setForgotSent(true);
        toast({ title: "تم", description: "تحقق من بريدك الإلكتروني لإعادة تعيين كلمة المرور" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md card-shadow animate-fade-in relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mb-4">
            <Rocket className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-primary tracking-wider mb-1">{systemName}</h1>
          <p className="text-muted-foreground text-sm">
            {signupSuccess ? "تحقق من بريدك الإلكتروني" : "ادخل إلى لوحة التحكم أو أنشئ متجراً جديداً"}
          </p>
        </CardHeader>

        <CardContent>
          {signupSuccess ? (
            <div className="space-y-4 text-center py-4">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-foreground">تم إنشاء حسابك</h2>
                <p className="text-sm text-muted-foreground">
                  أرسلنا رسالة تأكيد إلى <span className="font-semibold text-foreground" dir="ltr">{email}</span>.
                  افتح البريد واضغط على رابط التفعيل لتسجيل الدخول.
                </p>
                <p className="text-xs text-muted-foreground">
                  لم تجد الرسالة؟ تحقق من مجلد الرسائل غير المرغوب فيها (Spam).
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setSignupSuccess(false); setTab("signin"); setPassword(""); }}
              >
                العودة لتسجيل الدخول
              </Button>
            </div>
          ) : showForgot ? (
            <div className="space-y-4">
              {forgotSent ? (
                <div className="space-y-4 text-center py-4">
                  <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
                  <div className="space-y-2">
                    <h2 className="text-lg font-bold text-foreground">تحقق من بريدك</h2>
                    <p className="text-sm text-muted-foreground">
                      أرسلنا رابط إعادة تعيين كلمة المرور إلى <span className="font-semibold text-foreground" dir="ltr">{forgotEmail}</span>.
                    </p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}>
                    العودة لتسجيل الدخول
                  </Button>
                </div>
              ) : (
                <>
                  <Button variant="ghost" className="p-0 h-auto text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowForgot(false)}>
                    <ArrowRight className="w-4 h-4 ml-1" />
                    العودة لتسجيل الدخول
                  </Button>
                  <form onSubmit={handleForgot} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">البريد الإلكتروني</Label>
                      <div className="relative">
                        <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="forgot-email" type="email" placeholder="example@email.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="pr-10 text-left" dir="ltr" required />
                      </div>
                    </div>
                    <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={isLoading}>
                      {isLoading ? "جاري الإرسال..." : "إرسال رابط إعادة التعيين"}
                    </Button>
                  </form>
                </>
              )}
            </div>
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="signin">تسجيل الدخول</TabsTrigger>
                <TabsTrigger value="signup">إنشاء متجر</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-in">البريد الإلكتروني</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="email-in" type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pr-10 text-left" dir="ltr" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password-in">كلمة المرور</Label>
                      <button
                        type="button"
                        onClick={() => setShowForgot(true)}
                        className="text-xs text-primary hover:underline"
                      >
                        نسيت كلمة السر؟
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password-in"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="lucide lucide-eye-off w-4 h-4 text-right" /> : <Eye className="lucide lucide-eye w-4 h-4 text-right" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember-me"
                      checked={rememberMe}
                      onCheckedChange={(checked) => {
                        const on = checked === true;
                        setRememberMe(on);
                        if (!on) clearSavedLogin();
                      }}
                    />
                    <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">
                      حفظ البريد الإلكتروني وكلمة المرور
                    </Label>
                  </div>
                  <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={isLoading}>
                    {isLoading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullname">الاسم الكامل</Label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="fullname" type="text" placeholder="اسمك أو اسم متجرك" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pr-10" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">اسم المتجر (رابط المتجر)</Label>
                    <div className="relative">
                      <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="username" type="text" placeholder="my_store" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} className="pr-10 text-left" dir="ltr" required />
                    </div>
                    <p className="text-xs text-muted-foreground">سيكون رابط متجرك: /store/{username || "my_store"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-up">البريد الإلكتروني</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="email-up" type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pr-10 text-left" dir="ltr" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-up">كلمة المرور</Label>
                    <div className="relative">
                      <Input
                        id="password-up"
                        type={showPassword ? "text" : "password"}
                        placeholder="8 أحرف على الأقل"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="lucide lucide-eye-off w-4 h-4 text-right" /> : <Eye className="lucide lucide-eye w-4 h-4 text-right" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={isLoading}>
                    {isLoading ? "جاري إنشاء الحساب..." : "إنشاء حساب جديد"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    سنرسل رسالة تأكيد إلى بريدك الإلكتروني لتفعيل الحساب.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
