import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  iconGradient?: string;
  action?: ReactNode;
}

export const PageHeader = ({
  icon: Icon,
  title,
  description,
  iconGradient = "from-blue-500 to-indigo-500",
  action,
}: PageHeaderProps) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div className="flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${iconGradient} text-white flex items-center justify-center shadow-md shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export default PageHeader;