import { useBillingStatus } from "@/hooks/use-billing";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * Subtle banner for free-plan users encouraging upgrade.
 * Hidden for Pro/Custom subscribers.
 */
export function TrialBanner() {
  const { data: billing } = useBillingStatus();
  const navigate = useNavigate();

  // Hide for paid users or while loading
  if (!billing || billing.plan === "pro" || billing.plan === "custom") return null;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 text-xs bg-primary/5 border-b border-primary/10">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span>
          Plano gratuito —{" "}
          <span className="font-medium text-foreground">
            desbloqueie todas as funcionalidades
          </span>
        </span>
      </div>
      <button
        onClick={() => navigate("/planos")}
        className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Ver planos
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}
