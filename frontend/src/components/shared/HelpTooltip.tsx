import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface HelpTooltipProps {
  term: string;
  children: React.ReactNode;
}

const explanations: Record<string, string> = {
  "Reconciliação":
    "Reconciliação é o processo de ligar uma fatura ao respetivo movimento bancário, confirmando que o pagamento foi feito.",
  "NIF":
    "Número de Identificação Fiscal — o número de 9 dígitos que identifica cada empresa ou pessoa singular em Portugal.",
  "IVA":
    "Imposto sobre o Valor Acrescentado. Em Portugal as taxas são 23% (normal), 13% (intermédia) e 6% (reduzida).",
  "SNC":
    "Sistema de Normalização Contabilística — o plano de contas oficial português usado para classificar receitas e despesas.",
  "Conta SNC":
    "Código numérico do SNC que indica a categoria contabilística (ex: 62 = Fornecimentos e Serviços Externos).",
  "Base Tributável":
    "O valor da fatura antes de aplicar o IVA. É o total menos o imposto.",
  "Confiança":
    "Indica a certeza do OCR na leitura dos dados. Acima de 80% é fiável; abaixo de 60% deve ser revisto manualmente.",
  "OCR":
    "Reconhecimento Ótico de Caracteres — a tecnologia que lê o texto das suas faturas digitalizadas automaticamente.",
  "Pendente":
    "Documento ainda não revisto. Precisa de ser aprovado ou corrigido antes de ser contabilizado.",
  "Classificado":
    "Documento já aprovado e associado a uma conta SNC. Pronto para contabilização.",
};

export function HelpTooltip({ term, children }: HelpTooltipProps) {
  const explanation = explanations[term];
  if (!explanation) return <>{children}</>;

  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`O que é ${term}?`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" className="max-w-xs text-sm" sideOffset={5}>
          <p className="font-medium text-foreground mb-1">{term}</p>
          <p className="text-muted-foreground text-xs leading-relaxed">{explanation}</p>
        </PopoverContent>
      </Popover>
    </span>
  );
}
