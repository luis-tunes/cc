import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";
import type { ReactNode } from "react";

interface PageContainerProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageContainer({
  title,
  subtitle,
  actions,
  children,
  className,
}: PageContainerProps) {
  usePageTitle(title);
  return (
    <div className={cn("flex-1 overflow-auto", className)}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Page Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>

        {/* Page Content */}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
