import { useUser, OrganizationProfile } from "@clerk/react";
import { useBillingStatus } from "@/hooks/use-billing";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorState } from "@/components/shared/ErrorState";
import { cn } from "@/lib/utils";
import { Check, CreditCard, Loader2, Clock, ArrowRight, User, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { orgProfileAppearance } from "@/lib/clerk-appearance";

export default function SettingsPage() {
  const { user } = useUser();
  const { data: billing, isLoading: billingLoading, isError, refetch } = useBillingStatus();
  const navigate = useNavigate();
  const isLoading = billingLoading;
  const currentPlan = billing?.plan ?? "none";
  const isTrial = billing?.status === "trialing";
  const daysLeft = billing?.trial_days_left ?? 0;

  if (isError) {
    return (
      <PageContainer title="Definições" subtitle="Conta, subscrição e gestão da organização">
        <ErrorState onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Definições" subtitle="Conta, subscrição e gestão da organização">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Left column: Account + Subscription ── */}
        <div className="space-y-6">
          {/* Account */}
          <div className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 border-b px-5 py-3.5">
              <User className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Conta</h3>
            </div>
            <div className="p-5">
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
                  <span className="font-medium text-primary">
                    {currentPlan === "pro" ? "Profissional" : currentPlan === "custom" ? "Empresa" : isTrial ? "Teste Gratuito" : "—"}
                  </span>
                </div>
                {isTrial && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Teste expira em</span>
                    <span className={cn("font-medium", daysLeft <= 3 ? "text-tim-danger" : "text-foreground")}>
                      {daysLeft} dia{daysLeft !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Subscription */}
          <div className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 border-b px-5 py-3.5">
              <CreditCard className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Subscrição</h3>
            </div>
            <div className="p-5">
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : currentPlan === "pro" || currentPlan === "custom" ? (
                <div className="rounded-lg border border-tim-gold/30 bg-tim-gold/5 p-4">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-tim-success" />
                    <span className="text-sm font-semibold text-foreground">
                      Plano {currentPlan === "pro" ? "Profissional" : "Empresa"} ativo
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A sua subscrição está ativa. Obrigado por usar o TIM!
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      {isTrial ? `Teste gratuito — ${daysLeft} dias restantes` : "Sem plano ativo"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isTrial
                      ? "Subscreva antes do fim do teste para continuar a usar o TIM sem interrupções."
                      : "Escolha um plano para começar a usar o TIM."}
                  </p>
                  <button
                    onClick={() => navigate("/planos")}
                    className="mt-3 flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Ver planos
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right column: Organization & Team ── */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-5 py-3.5">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Organização e Equipa</h3>
          </div>
          <div className="p-5">
            <p className="text-xs text-muted-foreground mb-4">
              Gerir membros, convidar utilizadores e configurar permissões.
            </p>
            <OrganizationProfile
              appearance={orgProfileAppearance}
            />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
