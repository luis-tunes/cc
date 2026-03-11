import { useUser } from "@clerk/react";
import { useBillingPlans, useBillingStatus, useCheckout } from "@/hooks/use-billing";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/utils";
import { Check, CreditCard, Loader2, Mail, Phone } from "lucide-react";

export default function SettingsPage() {
  const { user } = useUser();
  const { data: plans = [], isLoading: plansLoading } = useBillingPlans();
  const { data: billing, isLoading: billingLoading } = useBillingStatus();
  const checkout = useCheckout();
  const isLoading = plansLoading || billingLoading;
  const currentPlan = billing?.plan ?? "none";

  return (
    <PageContainer title="Definições" subtitle="Conta, faturação e configurações">
      {/* Account */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Conta</h3>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="text-foreground">{user?.primaryEmailAddress?.emailAddress ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nome</span>
            <span className="text-foreground">{user?.fullName ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plano atual</span>
            <span className="font-medium text-tim-gold">
              {currentPlan === "pro" ? "Profissional" : currentPlan === "custom" ? "Empresa" : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <CreditCard className="h-4 w-4 text-tim-gold" />
          <h3 className="text-sm font-semibold text-foreground">Planos</h3>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 max-w-3xl">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlan;
              const isCustom = plan.id === "custom";
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "rounded-lg border p-6 transition-colors",
                    isCurrent ? "border-tim-gold bg-tim-gold/5" : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <h4 className="text-base font-semibold text-foreground">{plan.name}</h4>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {isCustom ? (
                      <span className="text-lg">Preço personalizado</span>
                    ) : (
                      <>
                        €{(plan.price / 100).toFixed(0)}
                        <span className="text-sm font-normal text-muted-foreground">/mês</span>
                        {plan.vat_note && (
                          <span className="block text-xs font-normal text-muted-foreground mt-1">{plan.vat_note}</span>
                        )}
                      </>
                    )}
                  </p>
                  <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-tim-success flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCustom ? (
                    <a
                      href={`mailto:${plan.contact}`}
                      className="mt-5 w-full flex items-center justify-center gap-2 rounded-md border border-tim-gold px-3 py-2.5 text-sm font-medium text-tim-gold hover:bg-tim-gold/10 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      Contacte-nos
                    </a>
                  ) : (
                    <button
                      disabled={isCurrent || checkout.isPending}
                      onClick={() => checkout.mutate(plan.id)}
                      className={cn(
                        "mt-5 w-full rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        isCurrent
                          ? "bg-muted text-muted-foreground cursor-default"
                          : "bg-tim-gold text-black hover:bg-tim-gold/90"
                      )}
                    >
                      {isCurrent ? "Plano atual" : "Subscrever"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
