import { useBillingPlans, useBillingStatus, useCheckout } from "@/hooks/use-billing";
import { cn } from "@/lib/utils";
import { Check, CreditCard, Loader2, Mail, ArrowRight, Shield, Zap, Clock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PricingPage() {
  const { data: plans = [], isLoading: plansLoading } = useBillingPlans();
  const { data: billing, isLoading: billingLoading } = useBillingStatus();
  const checkout = useCheckout();
  const navigate = useNavigate();
  const isLoading = plansLoading || billingLoading;
  const currentPlan = billing?.plan ?? "none";
  const isTrialing = billing?.status === "trialing";
  const isExpired = billing?.status === "trial_expired";
  const daysLeft = billing?.trial_days_left ?? 0;

  // If user already has a paid plan, redirect to dashboard
  if (billing && (currentPlan === "pro" || currentPlan === "custom")) {
    navigate("/painel", { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold tracking-tight text-primary">TIM</span>
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Time is Money
              </span>
            </div>
            {isTrialing && (
              <button
                onClick={() => navigate("/painel")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Continuar para o painel
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isExpired
              ? "O seu período de teste terminou"
              : isTrialing
                ? "Está a gostar do TIM?"
                : "Comece a usar o TIM"}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            {isExpired
              ? "Subscreva um plano para continuar a gerir a contabilidade da sua empresa de forma inteligente."
              : isTrialing
                ? `Faltam ${daysLeft} dias do seu teste gratuito. Subscreva para não perder os seus dados.`
                : "14 dias de teste gratuito. Sem cartão de crédito. Cancele a qualquer momento."}
          </p>
        </div>

        {/* Trial badge */}
        {!isTrialing && !isExpired && (
          <div className="mt-8 flex justify-center">
            <div className="flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2.5">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                14 dias grátis — comece agora
              </span>
            </div>
          </div>
        )}

        {/* Plans */}
        {isLoading ? (
          <div className="mt-12 flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-10 grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlan;
              const isCustom = plan.id === "custom";
              const isPro = plan.id === "pro";
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative rounded-xl border p-8 transition-all",
                    isPro
                      ? "border-primary/50 bg-card shadow-lg shadow-primary/5"
                      : "border-border bg-card hover:border-muted-foreground/30"
                  )}
                >
                  {isPro && (
                    <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground">
                      Recomendado
                    </div>
                  )}

                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  <div className="mt-4">
                    {isCustom ? (
                      <p className="text-lg font-semibold text-foreground">Preço personalizado</p>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-foreground">€{(plan.price / 100).toFixed(0)}</span>
                          <span className="text-sm text-muted-foreground">/mês</span>
                        </div>
                        {plan.vat_note && (
                          <p className="mt-1 text-xs text-muted-foreground">{plan.vat_note}</p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mt-6 h-px bg-border" />

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-tim-success" />
                        <span className="text-foreground/80">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    {isCustom ? (
                      <a
                        href={`mailto:${plan.contact}`}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Mail className="h-4 w-4" />
                        Contacte-nos
                      </a>
                    ) : (
                      <button
                        disabled={isCurrent || checkout.isPending}
                        onClick={() => checkout.mutate(plan.id)}
                        className={cn(
                          "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all",
                          isCurrent
                            ? "bg-muted text-muted-foreground cursor-default"
                            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/30"
                        )}
                      >
                        {checkout.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}
                        {isCurrent ? "Plano atual" : isTrialing || isExpired ? "Subscrever" : "Começar teste gratuito"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Trust strip */}
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          <TrustItem
            icon={Shield}
            title="Dados seguros"
            description="Encriptação de ponta a ponta. Os seus dados nunca são partilhados."
          />
          <TrustItem
            icon={Zap}
            title="Sem compromisso"
            description="Cancele a qualquer momento. Sem taxas de cancelamento."
          />
          <TrustItem
            icon={Sparkles}
            title="Suporte dedicado"
            description="Equipa portuguesa pronta para ajudar por email."
          />
        </div>
      </div>
    </div>
  );
}

function TrustItem({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card/50 p-5">
      <div className="rounded-md bg-primary/10 p-2">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
