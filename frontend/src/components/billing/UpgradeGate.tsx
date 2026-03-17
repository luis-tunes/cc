import { PageContainer } from "@/components/layout/PageContainer";
import { useBillingStatus } from "@/hooks/use-billing";
import { Lock, ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

interface UpgradeGateProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

/**
 * Wraps a proOnly page. If the user is on free trial, shows an upgrade
 * prompt instead of the page content. Paid users see the page normally.
 */
export function UpgradeGate({ children, title, subtitle }: UpgradeGateProps) {
  const { data: billing } = useBillingStatus();
  const navigate = useNavigate();

  // While loading or if paid, render children
  if (!billing || billing.plan === "pro" || billing.plan === "custom") {
    return <>{children}</>;
  }

  const daysLeft = billing.trial_days_left ?? 0;

  return (
    <PageContainer title={title} subtitle={subtitle}>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-primary/10 p-4 mb-6">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          Funcionalidade disponível no plano Profissional
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {daysLeft > 0
            ? `Esta funcionalidade requer uma subscrição ativa. Tem ${daysLeft} dias de teste gratuito — subscreva para desbloquear todas as funcionalidades do TIM.`
            : "Subscreva o plano Profissional para aceder a esta funcionalidade e a todas as ferramentas avançadas do TIM."}
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={() => navigate("/planos")}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Ver planos e preços
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate("/painel")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Voltar ao painel
          </button>
        </div>
      </div>
    </PageContainer>
  );
}
