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
  iconGradient,
  action,
}: PageHeaderProps) => (
  <header className="border-b border-foreground/90 pb-4 mb-2">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="eyebrow mb-2 flex items-center gap-2">
          <span className="num">§ {new Date().getFullYear()}</span>
          <span className="w-6 h-px bg-foreground/40" />
          <span>was-la / dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <Icon className="w-6 h-6 text-foreground shrink-0" strokeWidth={2.25} />
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl text-foreground truncate leading-none">
            {title}
          </h1>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  </header>
);

export default PageHeader;