import { ReactNode } from "react";
import { useUserContext } from "@/hooks/useUserContext";

interface Props {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export const RequirePermission = ({ permission, children, fallback = null }: Props) => {
  const { hasPermission, loading } = useUserContext();
  if (loading) return null;
  if (!hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
};