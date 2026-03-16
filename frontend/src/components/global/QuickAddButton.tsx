import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { GlobalUploadModal } from "./GlobalUploadModal";
import { Plus, ChevronRight, Clock, Zap } from "lucide-react";
import {
  ALL_ACTIONS,
  GROUP_LABELS,
  getPageContext,
  type QuickAction,
} from "@/lib/quick-add-config";

export function QuickAddButton() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadPreset, setUploadPreset] = useState<string | undefined>();
  const location = useLocation();

  const ctx = useMemo(() => getPageContext(location.pathname), [location.pathname]);

  // Keyboard shortcut: N to open menu
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          setMenuOpen((prev) => !prev);
        }
        if (e.key === "u" || e.key === "U") {
          e.preventDefault();
          setMenuOpen(false);
          setUploadOpen(true);
          setUploadPreset(undefined);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openUpload = (preset?: string) => {
    setUploadPreset(preset);
    setMenuOpen(false);
    setUploadOpen(true);
  };

  const handleAction = (action: QuickAction) => {
    if (action.disabled) return;
    // Upload-related actions
    if (action.group === "documentos" || action.id === "csv") {
      openUpload(action.uploadPreset);
    } else {
      // Non-upload actions — close menu (placeholder)
      setMenuOpen(false);
    }
  };

  // Split actions into recommended vs rest
  const recommended = useMemo(() => {
    return ctx.recommendedIds
      .map((id) => ALL_ACTIONS.find((a) => a.id === id))
      .filter(Boolean) as QuickAction[];
  }, [ctx]);

  const otherActions = useMemo(() => {
    const recSet = new Set(ctx.recommendedIds);
    return ALL_ACTIONS.filter((a) => !recSet.has(a.id));
  }, [ctx]);

  // Group remaining actions
  const groupedOthers = useMemo(() => {
    const groups: Record<string, QuickAction[]> = {};
    for (const a of otherActions) {
      if (!groups[a.group]) groups[a.group] = [];
      groups[a.group].push(a);
    }
    return Object.entries(groups)
      .filter(([, items]) => items.length > 0)
      .map(([key, items]) => ({ key, label: GROUP_LABELS[key] || key, items }));
  }, [otherActions]);

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            className={cn(
              "h-8 gap-1.5 bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-[0_0_12px_-2px_hsl(var(--tim-gold)/0.3)]",
              "hover:bg-primary/90 hover:shadow-[0_0_18px_-2px_hsl(var(--tim-gold)/0.45)]",
              "active:scale-[0.97] transition-all"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Novo</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-80 border-border bg-card p-0 shadow-2xl"
        >
          {/* Header with context hint */}
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-semibold text-foreground">Adicionar</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-2.5 w-2.5 text-primary" />
              {ctx.hint}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/50">
              Atalho · <kbd className="rounded border border-border bg-secondary px-1 font-mono text-xs">N</kbd>
            </p>
          </div>

          <div className="max-h-[460px] overflow-y-auto py-1">
            {/* Recommended section */}
            <p className="px-4 pb-1 pt-2.5 text-xs font-semibold uppercase tracking-widest text-primary/70">
              Sugestões para esta página
            </p>
            {recommended.map((item, i) => (
              <ActionRow
                key={item.id}
                action={item}
                highlighted={i === 0}
                onClick={() => handleAction(item)}
              />
            ))}

            {/* Separator */}
            <div className="mx-3 my-1.5 border-t border-border/50" />

            {/* Other grouped actions */}
            <p className="px-4 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              Mais ações
            </p>
            {groupedOthers.map((group, gi) => (
              <div key={group.key}>
                {gi > 0 && <div className="mx-3 my-1 border-t border-border/30" />}
                <p className="px-4 pb-0.5 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/40">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <ActionRow
                    key={item.id}
                    action={item}
                    highlighted={false}
                    onClick={() => handleAction(item)}
                  />
                ))}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <GlobalUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        preset={uploadPreset}
      />
    </>
  );
}

function ActionRow({
  action,
  highlighted,
  onClick,
}: {
  action: QuickAction;
  highlighted: boolean;
  onClick: () => void;
}) {
  const Icon = action.icon;
  return (
    <button
      onClick={onClick}
      disabled={action.disabled}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
        action.disabled
          ? "cursor-not-allowed opacity-40"
          : "hover:bg-secondary/50",
        highlighted && "bg-primary/5 border-l-2 border-primary"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          highlighted ? "text-primary" : "text-muted-foreground"
        )}
      />
      <span
        className={cn(
          "flex-1 text-xs",
          highlighted ? "font-semibold text-foreground" : "text-foreground/80"
        )}
      >
        {action.label}
      </span>
      {action.shortcut && (
        <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
          {action.shortcut}
        </kbd>
      )}
      {action.badge && (
        <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          {action.badge}
        </span>
      )}
      {!action.shortcut && !action.badge && !action.disabled && (
        <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
      )}
    </button>
  );
}
