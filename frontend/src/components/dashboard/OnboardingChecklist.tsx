import { cn } from "@/lib/utils";
import { 
  CheckCircle2, 
  Lock, 
  ChevronRight, 
  ChevronDown,
  Building2, 
  Settings2, 
  Landmark, 
  Upload, 
  FileSearch, 
  GitMerge, 
  Sparkles,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEntity } from "@/hooks/use-entity";
import { useState } from "react";

interface OnboardingChecklistProps {
  docCount: number;
  txCount: number;
  reconciled: number;
  classified?: number;
}

type StepState = "complete" | "available" | "locked";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  why: string;
  icon: typeof Building2;
  path: string;
  cta: string;
  secondaryCta?: string;
  /** When true, secondary CTA skips to the next available step instead of navigating to path */
  secondarySkips?: boolean;
  check: (props: OnboardingChecklistProps, hasEntity: boolean, hasFinancialContext: boolean) => boolean;
  isAvailable: (props: OnboardingChecklistProps, hasEntity: boolean, hasFinancialContext: boolean) => boolean;
}

const steps: OnboardingStep[] = [
  {
    id: "entity-setup",
    title: "Configurar empresa",
    description: "Introduza os dados base da empresa para melhorar a precisão da classificação automática.",
    why: "O TIM usa estes dados para reconhecer melhor documentos, movimentos, fornecedores, IVA e contexto fiscal.",
    icon: Building2,
    path: "/entidade",
    cta: "Preencher dados da empresa",
    check: (_, hasEntity) => hasEntity,
    isAvailable: () => true,
  },
  {
    id: "financial-context",
    title: "Definir contexto financeiro inicial",
    description: "Indique como a empresa opera para o TIM começar a classificar com mais contexto.",
    why: "Quanto melhor for o contexto inicial, menos correções terá de fazer depois.",
    icon: Settings2,
    path: "/entidade",
    cta: "Definir contexto financeiro", 
    secondaryCta: "Configurar mais tarde",
    secondarySkips: true,
    check: (_, __, hasFinancialContext) => hasFinancialContext,
    isAvailable: (_, hasEntity) => hasEntity,
  },
  {
    id: "import-bank",
    title: "Importar extrato bancário",
    description: "Carregue o primeiro ficheiro de movimentos para o TIM começar a analisar entradas e saídas.",
    why: "Este é o ponto de partida para identificar receitas, despesas e padrões recorrentes.",
    icon: Landmark,
    path: "/movimentos",
    cta: "Importar extrato",
    check: (props) => props.txCount > 0,
    isAvailable: () => true,
  },
  {
    id: "upload-docs",
    title: "Carregar primeiros documentos",
    description: "Adicione faturas, recibos ou outros documentos para extração e tratamento automático.",
    why: "Pode começar com poucos documentos. O importante é dar exemplos reais ao sistema.",
    icon: Upload,
    path: "/caixa-entrada",
    cta: "Carregar documentos",
    check: (props) => props.docCount > 0,
    isAvailable: () => true,
  },
  {
    id: "review-classifications",
    title: "Rever primeiras classificações",
    description: "Valide as primeiras sugestões do TIM para afinar a lógica da conta.",
    why: "Esta revisão inicial melhora bastante a qualidade das classificações futuras.",
    icon: FileSearch,
    path: "/classificacoes",
    cta: "Rever classificações",
    check: (props) => (props.classified || 0) > 0,
    isAvailable: (props) => props.docCount > 0 || props.txCount > 0,
  },
  {
    id: "reconciliation",
    title: "Executar primeira reconciliação",
    description: "Cruze documentos e movimentos para fechar o primeiro ciclo operacional.",
    why: "Depois desta etapa, o Painel fica muito mais útil e fiável.",
    icon: GitMerge,
    path: "/reconciliacao",
    cta: "Executar reconciliação",
    check: (props) => props.reconciled > 0,
    isAvailable: (props) => props.docCount > 0 && props.txCount > 0,
  },
];

export function OnboardingChecklist(props: OnboardingChecklistProps) {
  const navigate = useNavigate();
  const { data: entityData } = useEntity();
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  // Check if entity has basic data (NIF filled)
  const hasEntity = !!(entityData?.nif?.trim());
  
  // Check if entity has financial context (both regimes filled)
  const hasFinancialContext = !!(entityData?.vatRegime?.trim() && entityData?.accountingRegime?.trim());

  // Calculate step states
  const stepStates = steps.map(step => {
    const isComplete = step.check(props, hasEntity, hasFinancialContext);
    const isAvailable = step.isAvailable(props, hasEntity, hasFinancialContext);
    
    const state: StepState = isComplete ? "complete" : isAvailable ? "available" : "locked";
    
    return {
      ...step,
      state,
    };
  });

  // Find first available (non-complete) step as current
  const currentStepIndex = stepStates.findIndex(step => step.state === 'available');
  
  // Count completed steps  
  const completedCount = stepStates.filter(step => step.state === 'complete').length;
  const totalSteps = steps.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  // Show AI context warning when step 1 not complete
  const showAIWarning = !hasEntity;

  const handleStepClick = (step: typeof stepStates[0], index: number) => {
    if (step.state === 'locked') return;
    
    // If clicking current step or available step, navigate
    if (step.state === 'available') {
      navigate(step.path);
    }
  };

  const toggleExpanded = (stepId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedStep(expandedStep === stepId ? null : stepId);
  };

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      {/* Header */}
      <div className="border-b bg-gradient-to-r from-card to-card/80 px-6 py-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-tim-gold" />
              <h3 className="text-lg font-semibold text-foreground">
                Configure a base da sua conta
              </h3>
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Complete estes passos para melhorar a precisão da classificação automática e desbloquear o modo operacional.
            </p>
            
            {/* AI Warning */}
            {showAIWarning && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-tim-warning/10 px-3 py-2 text-xs text-tim-warning">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Sem os dados da empresa, a classificação automática será menos precisa.</span>
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-foreground">
                {completedCount} de {totalSteps} passos
              </div>
              <div className="text-xs text-muted-foreground">
                {progressPercent}% concluído
              </div>
            </div>
            <div className="relative h-12 w-12">
              <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="2"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="hsl(var(--tim-gold))"
                  strokeWidth="2"
                  strokeDasharray={`${progressPercent}, 100`}
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-tim-gold">
                  {progressPercent}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-border/40">
        {stepStates.map((step, index) => {
          const Icon = step.icon;
          const isExpanded = expandedStep === step.id;
          const isCurrent = index === currentStepIndex;
          
          return (
            <div key={step.id} className="group">
              <button
                onClick={() => handleStepClick(step, index)}
                disabled={step.state === 'locked'}
                className={cn(
                  "flex w-full items-center gap-4 px-6 py-4 text-left transition-all duration-200",
                  step.state === 'locked' && "cursor-not-allowed opacity-50",
                  step.state === 'available' && "hover:bg-accent/30 hover:-translate-y-0.5 hover:shadow-sm",
                  step.state === 'complete' && "opacity-75 hover:opacity-90",
                  isCurrent && step.state === 'available' && "bg-tim-gold/5 border-l-2 border-l-tim-gold"
                )}
              >
                {/* State Icon */}
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                  step.state === 'complete' && "border-tim-success bg-tim-success/10",
                  step.state === 'available' && "border-tim-gold/40 bg-tim-gold/5",
                  step.state === 'locked' && "border-muted bg-muted/20",
                  isCurrent && step.state === 'available' && "border-tim-gold bg-tim-gold/10 shadow-[0_0_0_3px_hsl(var(--tim-gold)/0.1)]"
                )}>
                  {step.state === 'complete' ? (
                    <CheckCircle2 className="h-5 w-5 text-tim-success" />
                  ) : step.state === 'locked' ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Icon className={cn(
                      "h-5 w-5",
                      isCurrent ? "text-tim-gold" : "text-muted-foreground"
                    )} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={cn(
                      "text-sm font-semibold transition-colors",
                      step.state === 'complete' && "text-muted-foreground line-through",
                      step.state === 'available' && "text-foreground",
                      step.state === 'locked' && "text-muted-foreground",
                      isCurrent && "text-tim-gold"
                    )}>
                      {step.title}
                    </h4>
                    {step.state === 'available' && (
                      <button
                        onClick={(e) => toggleExpanded(step.id, e)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={isExpanded ? "Recolher detalhes" : "Expandir detalhes"}
                      >
                        <ChevronDown className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          isExpanded && "rotate-180"
                        )} />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Action */}
                <div className="flex items-center gap-2">
                  {step.state === 'available' && (
                    <>
                      {step.secondaryCta && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (step.secondarySkips) {
                              const nextAvailable = stepStates.find((s, i) => 
                                i > index && s.state === 'available'
                              );
                              if (nextAvailable) {
                                navigate(nextAvailable.path);
                              }
                            }
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {step.secondaryCta}
                        </button>
                      )}
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-all",
                        isCurrent ? "text-tim-gold" : "text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5"
                      )} />
                    </>
                  )}
                </div>
              </button>

              {/* Expanded Why Section */}
              {isExpanded && step.state === 'available' && (
                <div className="bg-accent/20 px-6 py-3 border-t border-accent/40 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-4 w-4 text-tim-gold mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-foreground mb-1">
                        Porquê este passo?
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {step.why}
                      </p>
                      <button
                        onClick={() => navigate(step.path)}
                        className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-tim-gold hover:text-tim-gold/80 transition-colors"
                      >
                        {step.cta}
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completion State */}
      {completedCount === totalSteps && (
        <div className="border-t bg-gradient-to-r from-tim-gold/5 to-tim-success/5 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-tim-success/10 border-2 border-tim-success">
                <CheckCircle2 className="h-5 w-5 text-tim-success" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Começar a operar com o TIM
                </h4>
                <p className="text-xs text-muted-foreground">
                  Com a base configurada, pode agora acompanhar a operação com mais precisão.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/painel')}
              className="inline-flex items-center gap-2 rounded-md bg-tim-gold px-4 py-2 text-xs font-medium text-white hover:bg-tim-gold/90 transition-colors shadow-sm hover:shadow-md"
            >
              Ir para o Painel
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
