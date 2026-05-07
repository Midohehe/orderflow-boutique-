import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserContext } from "@/hooks/useUserContext";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, signOut } = useAuth();
  const { subscriptionActive, profile, isAdmin, loading: ctxLoading } = useUserContext();

  if (loading || ctxLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin && (!profile || !subscriptionActive)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
        <div className="max-w-md w-full bg-card border rounded-lg p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold text-destructive">انتهى اشتراكك</h2>
          <p className="text-muted-foreground">
            لقد انتهى اشتراكك في النظام أو تم تعطيل حسابك. يرجى التواصل مع الإدارة لتجديد الاشتراك.
          </p>
          <Button onClick={async () => { await signOut(); window.location.href = "/"; }} variant="outline" className="w-full">
            تسجيل الخروج
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
