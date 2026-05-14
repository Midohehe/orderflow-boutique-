import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface SectionCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  iconColor?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const SectionCard = ({
  icon: Icon,
  title,
  description,
  iconColor = "bg-blue-500",
  action,
  children,
  className = "",
}: SectionCardProps) => (
  <div className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden ${className}`}>
    <div className="flex items-start gap-3 px-4 py-3 border-b bg-muted/40">
      <div className={`w-9 h-9 rounded-lg ${iconColor} text-white flex items-center justify-center shadow-sm shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-foreground leading-tight">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    <div className="p-4 space-y-4">{children}</div>
  </div>
);

export default SectionCard;