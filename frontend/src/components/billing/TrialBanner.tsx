import { useBillingStatus } from "@/hooks/use-billing";
import { useNavigate } from "react-router-dom";
import { Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function TrialBanner() {
  const { data: billing } = useBillingStatus();
  const navigate = useNavigate();

  // Only show for trial users
  if (!billing || billing.plan === "pro" || billing.plan === "custom") return null;

  const daysLeft = billing.trial_days_left ?? 0;
  const isExpired = billing.status === "trial_expired";
  const isTrial = billing.status === "trialing";

  if (!isTrial && !isExpired) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2 text-xs",
        isExpired
          ? "bg-tim-danger/15 text-tim-danger"
          : daysLeft <= 3
            ? "bg-tim-warning/15 text-tim-warning"
            : "bg-primary/10 text-primary"
      )}
    >
      <div className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5" />
        <span className="font-medium">
          {isExpired
            ? "O seu período de teste terminou. Subscreva para continuar a usar o TIM."
            : `${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""} do período de teste gratuito`}
        </span>
      </div>
      <button
        onClick={() => navigate("/planos")}
        className={cn(
          "flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition-colors",
          isExpired
            ? "bg-tim-danger text-white hover:bg-tim-danger/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {isExpired ? "Subscrever agora" : "Ver planos"}
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}
