import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();

  return (
    <div className={cn("flex-1 overflow-auto", className)}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Page Header — hidden on mobile since AppTopbar shows title */}
        {!isMobile && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        )}
        {isMobile && actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}

        {/* Page Content */}
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">{children}</div>
      </div>
    </div>
  );
}
