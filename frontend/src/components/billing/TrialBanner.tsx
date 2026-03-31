import { useBillingStatus } from "@/hooks/use-billing";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { useState, useEffect } from "react";

const DISMISS_KEY = "tim-trial-banner-dismissed";

/**
 * Subtle banner for free-plan users encouraging upgrade.
 * Hidden for Pro/Custom subscribers or if dismissed this session.
 */
export function TrialBanner() {
  const { data: billing } = useBillingStatus();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
    }
  }, []);

  // Hide for paid users, while loading, or if dismissed
  if (!billing || billing.plan === "pro" || billing.plan === "custom" || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs bg-primary/5 border-b border-primary/10 animate-in slide-in-from-top-1 duration-300">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span>
          Plano gratuito —{" "}
          <span className="font-medium text-foreground">
            desbloqueie todas as funcionalidades
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/planos")}
          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Ver planos
          <ArrowRight className="h-3 w-3" />
        </button>
        <button
          onClick={handleDismiss}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Fechar"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
