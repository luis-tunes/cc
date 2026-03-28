import { useUser, OrganizationProfile } from "@clerk/react";
import { useBillingStatus } from "@/hooks/use-billing";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorState } from "@/components/shared/ErrorState";
import { cn } from "@/lib/utils";
import { Check, CreditCard, Loader2, Clock, ArrowRight, Shield, Users, Sparkles, HelpCircle, Mail } from "lucide-react";
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
      <div className="space-y-5 max-w-2xl">

        {/* ── Subscription status ── */}
        <section className={cn(
          "rounded-xl border p-5",
          isPaid
            ? "border-tim-success/30 bg-tim-success/5"
            : daysLeft <= 3 && isTrial
              ? "border-tim-warning/30 bg-tim-warning/5"
              : "border-primary/20 bg-primary/5"
        )}>
          <div className="flex items-start gap-3">
            <div className={cn(
              "mt-0.5 shrink-0 rounded-full p-2",
              isPaid ? "bg-tim-success/10" : "bg-primary/10"
            )}>
              {isPaid ? (
                <Shield className="h-5 w-5 text-tim-success" />
              ) : (
                <Clock className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Plano {planLabel}
                </h3>
                {isPaid && (
                  <span className="inline-flex items-center rounded-full bg-tim-success/20 px-2 py-0.5 text-xs font-medium text-tim-success">
                    Ativo
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {isPaid
                  ? "A sua subscrição está ativa. Todas as funcionalidades estão disponíveis."
                  : isTrial
                    ? `Tem ${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""} para experimentar o xtim.ai.`
                    : "Escolha um plano para continuar a usar o xtim.ai."}
              </p>
              {!isPaid && (
                <button
                  onClick={() => navigate("/planos")}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isTrial ? "Subscrever agora" : "Ver planos"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {!isPaid && (
            <div className="mt-4 rounded-lg border border-border/40 bg-card/60 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Incluído no teste gratuito:</p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {["Painel e documentos", "Movimentos bancários", "Inventário e fornecedores", "Produtos e lista de compras"].map((f) => (
                  <div key={f} className="flex items-center gap-1.5 text-xs text-foreground/80">
                    <Check className="h-3 w-3 text-tim-success shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Account info ── */}
        <section className="rounded-xl border bg-card">
          <div className="flex items-center gap-3 border-b px-5 py-3.5">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">A minha conta</h3>
          </div>
          <div className="px-5 py-4">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Nome</p>
                  <p className="text-sm font-medium text-foreground truncate">{user?.fullName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                  <p className="text-sm font-medium text-foreground truncate">{user?.primaryEmailAddress?.emailAddress ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Plano</p>
                  <p className="text-sm font-medium text-primary">{planLabel}</p>
                </div>
                {isTrial && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Teste termina em</p>
                    <p className={cn("text-sm font-medium", daysLeft <= 3 ? "text-tim-danger" : "text-foreground")}>
                      {daysLeft} dia{daysLeft !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Team / Organization ── */}
        <section className="rounded-xl border bg-card">
          <div className="flex items-center gap-3 border-b px-5 py-3.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Equipa</h3>
              <p className="text-xs text-muted-foreground">Convidar colegas e gerir permissões</p>
            </div>
          </div>
          <div className="px-5 py-4">
            <OrganizationProfile
              appearance={orgProfileAppearance}
              routing="hash"
            />
          </div>
        </section>

        {/* ── Help ── */}
        <section className="rounded-xl border bg-card px-5 py-4">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Precisa de ajuda?</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Envie-nos um email para{" "}
                <a href="mailto:info@tim.pt" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                  <Mail className="h-3 w-3" />
                  info@tim.pt
                </a>
                {" "}— respondemos em menos de 24 horas.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
