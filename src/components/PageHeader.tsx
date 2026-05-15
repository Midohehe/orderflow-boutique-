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
  action,
}: PageHeaderProps) => (
  <header className="pb-5 mb-3 border-b border-border/70">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-secondary text-foreground/70 shrink-0">
            <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
          </span>
          <h1 className="font-display text-2xl sm:text-3xl md:text-[34px] text-foreground truncate leading-tight">
            {title}
          </h1>
        </div>
        {description && (
          <p className="text-[15px] text-muted-foreground mt-2 max-w-2xl leading-relaxed pr-12">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  </header>
);

export default PageHeader;