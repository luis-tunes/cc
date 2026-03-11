import { useUser } from "@clerk/react";
import { useBillingPlans, useBillingStatus, useCheckout } from "@/hooks/use-billing";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/utils";
import { Check, CreditCard, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { user } = useUser();
  const { data: plans = [], isLoading: plansLoading } = useBillingPlans();
  const { data: billing, isLoading: billingLoading } = useBillingStatus();
  const checkout = useCheckout();
  const isLoading = plansLoading || billingLoading;
  const currentPlan = billing?.plan ?? "free";

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
            <span className="font-medium text-tim-gold">{currentPlan.toUpperCase()}</span>
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
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlan;
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "rounded-lg border p-5 transition-colors",
                    isCurrent ? "border-tim-gold bg-tim-gold/5" : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <h4 className="text-sm font-semibold text-foreground">{plan.name}</h4>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {plan.price === 0 ? "Grátis" : `€${(plan.price / 100).toFixed(0)}`}
                    {plan.price > 0 && <span className="text-xs font-normal text-muted-foreground">/mês</span>}
                  </p>
                  <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-tim-success" />
                      {plan.docs_per_month === -1 ? "Docs ilimitados" : `${plan.docs_per_month} docs/mês`}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-tim-success" />
                      {plan.seats === 1 ? "1 utilizador" : `${plan.seats} utilizadores`}
                    </li>
                  </ul>
                  <button
                    disabled={isCurrent || checkout.isPending || plan.id === "free"}
                    onClick={() => checkout.mutate(plan.id)}
                    className={cn(
                      "mt-4 w-full rounded-md px-3 py-2 text-xs font-medium transition-colors",
                      isCurrent
                        ? "bg-muted text-muted-foreground cursor-default"
                        : plan.id === "free"
                          ? "bg-muted text-muted-foreground cursor-default"
                          : "bg-tim-gold text-black hover:bg-tim-gold/90"
                    )}
                  >
                    {isCurrent ? "Plano atual" : plan.id === "free" ? "Grátis" : "Upgrade"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
