import { cn } from "@/lib/utils";
import { FolderOpen, Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  illustration?: string;
  title: string;
  description?: string;
  tutorial?: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = FolderOpen,
  illustration,
  title,
  description,
  tutorial,
  actionLabel,
  actionIcon: ActionIcon = Plus,
  onAction,
  secondaryLabel,
  onSecondary,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center animate-in fade-in slide-in-from-bottom-2 duration-300",
        className,
      )}
    >
      {illustration ? (
        <span className="text-4xl" role="img" aria-hidden="true">{illustration}</span>
      ) : (
        <div className="rounded-xl bg-primary/[0.08] p-4">
          <Icon className="h-7 w-7 text-primary/70" />
        </div>
      )}
      <h3 className="mt-5 text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {tutorial && (
        <p className="mt-3 max-w-sm text-xs text-muted-foreground/70 leading-relaxed">
          {tutorial}
        </p>
      )}
      {actionLabel && onAction && (
        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row">
          <Button size="sm" className="gap-1.5" onClick={onAction}>
            <ActionIcon className="h-3.5 w-3.5" />
            {actionLabel}
          </Button>
          {secondaryLabel && onSecondary && (
            <Button variant="ghost" size="sm" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
