import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Upload, Landmark, GitMerge, Building2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEntity } from "@/hooks/use-entity";

interface OnboardingChecklistProps {
  docCount: number;
  txCount: number;
  reconciled: number;
}

const steps = [
  {
    id: "upload",
    title: "Carregar o primeiro documento",
    description: "Faça upload de uma fatura ou recibo PDF para começar",
    icon: Upload,
    path: "/caixa-entrada",
    check: (p: OnboardingChecklistProps) => p.docCount > 0,
  },
  {
    id: "csv",
    title: "Importar extrato bancário",
    description: "Importe um ficheiro CSV com os seus movimentos bancários",
    icon: Landmark,
    path: "/movimentos",
    check: (p: OnboardingChecklistProps) => p.txCount > 0,
  },
  {
    id: "reconcile",
    title: "Executar a primeira reconciliação",
    description: "O xtim.ai cruza automaticamente documentos com movimentos",
    icon: GitMerge,
    path: "/reconciliacao",
    check: (p: OnboardingChecklistProps) => p.reconciled > 0,
  },
  {
    id: "entity",
    title: "Preencher perfil da entidade",
    description: "Configure os dados fiscais da sua empresa (NIF, morada, CAE)",
    icon: Building2,
    path: "/entidade",
    check: "entity",
  },
];

export function OnboardingChecklist(props: OnboardingChecklistProps) {
  const navigate = useNavigate();
  const { data: entityData } = useEntity();
  const hasEntity = !!(entityData && Object.keys(entityData).length > 0 && entityData.nif);
  const completed = steps.filter((s) => {
    if (s.check === "entity") return hasEntity;
    return (s.check as (p: OnboardingChecklistProps) => boolean)(props);
  }).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Bem-vindo ao xtim.ai 👋
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Complete estes passos para configurar a sua conta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {completed}/{steps.length}
          </span>
        </div>
      </div>

      <div className="divide-y divide-border/50">
        {steps.map((step) => {
          const done = step.check === "entity" ? hasEntity : (step.check as (p: OnboardingChecklistProps) => boolean)(props);
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              onClick={() => navigate(step.path)}
              className={cn(
                "flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-accent/50",
                done && "opacity-60"
              )}
            >
              {done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-tim-success" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium",
                  done ? "text-muted-foreground line-through" : "text-foreground"
                )}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {!done && (
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
