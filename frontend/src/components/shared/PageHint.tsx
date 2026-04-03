import { useState } from "react";
import { X, Lightbulb } from "lucide-react";

interface PageHintProps {
  /** Unique key used for localStorage dismissal (e.g. "inbox", "movements") */
  id: string;
  children: React.ReactNode;
}

const STORAGE_PREFIX = "tim-hint-dismissed-";

/**
 * First-visit inline micro-guide that appears once per page.
 * Dismissed permanently via localStorage.
 */
export function PageHint({ id, children }: PageHintProps) {
  const storageKey = `${STORAGE_PREFIX}${id}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch { /* ignore */ }
  };

  return (
    <div className="relative flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="flex-1 leading-relaxed">{children}</div>
      <button
        onClick={dismiss}
        className="shrink-0 rounded-md p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
        aria-label="Fechar dica"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
