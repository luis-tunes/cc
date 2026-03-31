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
 * Wraps a proOnly page. Free-plan users see a blurred preview with upgrade prompt.
 * Pro/Custom subscribers see the page content normally.
 */
export function UpgradeGate({ children, title, subtitle }: UpgradeGateProps) {
  const { data: billing, isLoading } = useBillingStatus();
  const navigate = useNavigate();

  // Show nothing extra while billing status is being fetched
  if (isLoading) {
    return <>{children}</>;
  }

  // If paid, render children
  if (!billing || billing.plan === "pro" || billing.plan === "custom") {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Blurred page preview */}
      <div
        className="pointer-events-none select-none overflow-hidden"
        style={{ maxHeight: "70vh", filter: "blur(6px)", opacity: 0.5 }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay CTA */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
        <div className="mx-4 flex max-w-md flex-col items-center rounded-2xl border bg-card p-8 text-center shadow-xl">
          <div className="rounded-full bg-primary/10 p-4 mb-5">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Funcionalidade disponível no plano Profissional
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Subscreva o plano Profissional para aceder a esta funcionalidade e a todas as ferramentas avançadas do xtim.ai.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              onClick={() => navigate("/planos")}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:-translate-y-0.5"
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
      </div>
    </div>
  );
}
