import { useUser, OrganizationProfile } from "@clerk/react";
import { useBillingPlans, useBillingStatus, useCheckout } from "@/hooks/use-billing";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/utils";
import { Check, CreditCard, Loader2, Mail, Clock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const { user } = useUser();
  const { data: billing, isLoading: billingLoading } = useBillingStatus();
  const navigate = useNavigate();
  const isLoading = billingLoading;
  const currentPlan = billing?.plan ?? "none";
  const isTrial = billing?.status === "trialing";
  const daysLeft = billing?.trial_days_left ?? 0;

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

      {/* Plan / Upgrade */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-tim-gold" />
            <h3 className="text-sm font-semibold text-foreground">Subscrição</h3>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : currentPlan === "pro" || currentPlan === "custom" ? (
          <div className="rounded-lg border border-tim-gold/30 bg-tim-gold/5 p-5">
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
          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-5">
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

      {/* Organization Management */}
      <div className="rounded-lg border bg-card p-6 mt-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Organização e Equipa</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Gerir membros, convidar utilizadores e configurar permissões da organização.
        </p>
        <OrganizationProfile
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-transparent shadow-none border-0 p-0",
              navbar: "hidden",
              pageScrollBox: "p-0",
            },
          }}
        />
      </div>
    </PageContainer>
  );
}
