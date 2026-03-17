import { useUser, OrganizationProfile } from "@clerk/react";
import { useBillingStatus } from "@/hooks/use-billing";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorState } from "@/components/shared/ErrorState";
import { cn } from "@/lib/utils";
import { Check, CreditCard, Loader2, Clock, ArrowRight, Shield, Users, Sparkles, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { orgProfileAppearance } from "@/lib/clerk-appearance";

export default function SettingsPage() {
  const { user } = useUser();
  const { data: billing, isLoading: billingLoading, isError, refetch } = useBillingStatus();
  const navigate = useNavigate();
  const isLoading = billingLoading;
  const currentPlan = billing?.plan ?? "none";
  const isPaid = currentPlan === "pro" || currentPlan === "custom";
  const isTrial = billing?.status === "trialing";
  const daysLeft = billing?.trial_days_left ?? 0;

  if (isError) {
    return (
      <PageContainer title="Definições" subtitle="Gerir a sua conta e subscrição">
        <ErrorState onRetry={refetch} />
      </PageContainer>
    );
  }

  const planLabel = currentPlan === "pro" ? "Profissional" : currentPlan === "custom" ? "Empresa" : "Teste Gratuito";

  return (
    <PageContainer title="Definições" subtitle="Gerir a sua conta e subscrição">
      <div className="space-y-6 max-w-4xl">

        {/* ── Subscription status card ── */}
        <div className={cn(
          "rounded-xl border-2 p-6",
          isPaid
            ? "border-tim-success/30 bg-tim-success/5"
            : daysLeft <= 3 && isTrial
              ? "border-tim-warning/30 bg-tim-warning/5"
              : "border-primary/20 bg-primary/5"
        )}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className={cn(
                "rounded-lg p-2.5",
                isPaid ? "bg-tim-success/10" : "bg-primary/10"
              )}>
                {isPaid ? (
                  <Shield className="h-6 w-6 text-tim-success" />
                ) : (
                  <Clock className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">
                    Plano {planLabel}
                  </h3>
                  {isPaid && (
                    <span className="rounded-full bg-tim-success/20 px-2 py-0.5 text-xs font-medium text-tim-success">
                      Ativo
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isPaid
                    ? "A sua subscrição está ativa. Todas as funcionalidades estão disponíveis."
                    : isTrial
                      ? `Tem ${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""} para experimentar o TIM. Algumas funcionalidades requerem subscrição.`
                      : "Escolha um plano para continuar a usar o TIM."}
                </p>
              </div>
            </div>
            {!isPaid && (
              <button
                onClick={() => navigate("/planos")}
                className="flex items-center gap-2 self-start rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/15 hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                <Sparkles className="h-4 w-4" />
                {isTrial ? "Subscrever" : "Ver planos"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* What's included in trial */}
          {!isPaid && (
            <div className="mt-5 rounded-lg border border-border/50 bg-card/80 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2.5">Incluído no teste gratuito:</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {["Painel e documentos", "Movimentos bancários", "Inventário e fornecedores", "Produtos e lista de compras"].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs text-foreground/80">
                    <Check className="h-3 w-3 text-tim-success shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-xs text-muted-foreground/80">
                Reconciliação, relatórios, centro fiscal e assistente IA requerem o plano Profissional.
              </p>
            </div>
          )}
        </div>

        {/* ── Account info ── */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-3 border-b px-6 py-4">
            <div className="rounded-md bg-primary/10 p-1.5">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">A minha conta</h3>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Nome</p>
                  <p className="text-sm font-medium text-foreground">{user?.fullName ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium text-foreground">{user?.primaryEmailAddress?.emailAddress ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Plano</p>
                  <p className="text-sm font-medium text-primary">{planLabel}</p>
                </div>
                {isTrial && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Teste termina em</p>
                    <p className={cn("text-sm font-medium", daysLeft <= 3 ? "text-tim-danger" : "text-foreground")}>
                      {daysLeft} dia{daysLeft !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Team / Organization ── */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-1.5">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Equipa</h3>
                <p className="text-xs text-muted-foreground">Convidar colegas e gerir permissões</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <OrganizationProfile
              appearance={orgProfileAppearance}
            />
          </div>
        </div>

        {/* ── Help ── */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-md bg-primary/10 p-1.5">
              <HelpCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Precisa de ajuda?</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Envie-nos um email para <a href="mailto:info@tim.pt" className="font-medium text-primary hover:underline">info@tim.pt</a> — respondemos em menos de 24 horas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
