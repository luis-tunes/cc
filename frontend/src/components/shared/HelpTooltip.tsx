import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HelpTooltipProps {
  term: string;
  children: React.ReactNode;
}

/**
 * Centralized dictionary of plain-language explanations for all
 * accounting, financial, and app-specific terms used in the UI.
 * Every tooltip in the app reads from this single source of truth.
 */
export const explanations: Record<string, string> = {
  /* ── Document pipeline ──────────────────────────────────────── */
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

  /* ── Document statuses ──────────────────────────────────────── */
  "Pendente":
    "Documento ainda não revisto. Precisa de ser aprovado ou corrigido antes de ser contabilizado.",
  "Importado":
    "Documento recebido pelo sistema mas ainda não processado pela IA.",
  "Extraído":
    "A IA leu os dados do documento (fornecedor, valor, data). Aguarda revisão.",
  "Classificado":
    "Documento já aprovado e associado a uma conta SNC. Pronto para contabilização.",
  "Reconciliado":
    "Fatura com pagamento bancário confirmado. A transação está verificada.",
  "Revisto":
    "Documento verificado e aprovado manualmente. Dados confirmados como corretos.",
  "Arquivado":
    "Documento guardado no arquivo. Já não aparece nas listas ativas.",
  "Atrasado":
    "Documento ou obrigação que ultrapassou o prazo previsto.",
  "Anomalia":
    "O sistema detetou algo invulgar neste documento (valor fora do padrão, dados em falta, etc.).",
  "Rejeitado":
    "Documento recusado — pode conter erros ou não ser elegível para processamento.",

  /* ── Dashboard KPIs ─────────────────────────────────────────── */
  "Documentos":
    "Total de faturas, recibos e outros documentos carregados no sistema.",
  "Movimentos":
    "Transações importadas do seu extrato bancário (débitos e créditos).",
  "Reconciliados":
    "Faturas que já foram verificadas contra o seu extrato bancário.",
  "Pendentes":
    "Documentos ou movimentos que ainda precisam de atenção — revisão, classificação ou reconciliação.",
  "Receitas":
    "Total de vendas e outros rendimentos registados no período.",
  "Despesas":
    "Total de compras, fornecimentos e outros gastos registados no período.",
  "Resultado":
    "Receitas menos despesas. Positivo = lucro; negativo = prejuízo.",

  /* ── Bank movements ─────────────────────────────────────────── */
  "Importar CSV":
    "Ficheiro do extrato bancário exportado do site do seu banco. Formato CSV (valores separados por vírgulas).",
  "Classificar tudo":
    "Atribuir automaticamente uma categoria contabilística a cada movimento bancário usando inteligência artificial.",
  "Débito":
    "Dinheiro que saiu da conta — pagamentos, transferências, levantamentos.",
  "Crédito":
    "Dinheiro que entrou na conta — recebimentos, transferências recebidas.",

  /* ── Reconciliation ─────────────────────────────────────────── */
  "Exceção":
    "Caso especial que precisa de investigação manual — o sistema não conseguiu fazer a correspondência com confiança.",
  "Auto-matched":
    "Par documento-pagamento encontrado automaticamente com alta confiança.",
  "Sugerido":
    "Par possível que o sistema sugere, mas que precisa da sua confirmação.",

  /* ── Classification rules ───────────────────────────────────── */
  "Operador":
    "Define como comparar: 'contém' procura a palavra no texto, 'igual a' exige correspondência exata, '>=' e '<=' comparam valores.",
  "Regra de Classificação":
    "Regra automática: quando um documento cumpre a condição, é associado a uma conta SNC sem intervenção manual.",

  /* ── Chart of Accounts / Accounting ─────────────────────────── */
  "Classe 1":
    "Meios financeiros líquidos — dinheiro em caixa e depósitos bancários.",
  "Classe 2":
    "Contas a receber e a pagar — clientes, fornecedores, Estado.",
  "Classe 3":
    "Inventários e ativos biológicos — mercadorias e matérias-primas em stock.",
  "Classe 4":
    "Investimentos — ativos fixos, equipamentos, propriedades.",
  "Classe 5":
    "Capital, reservas e resultados transitados — o património dos sócios.",
  "Classe 6":
    "Gastos e perdas — todas as despesas do negócio (compras, salários, rendas, etc.).",
  "Classe 7":
    "Rendimentos e ganhos — toda a faturação, vendas e outras receitas.",
  "Classe 8":
    "Resultados — apuramento do lucro ou prejuízo do exercício.",
  "Débito/Crédito":
    "Débito = entrada de valor na conta. Crédito = saída de valor da conta. Cada lançamento deve ter débitos iguais a créditos.",
  "Balancete":
    "Verificação de que todos os débitos igualam os créditos. Se não bater, há um erro nos lançamentos.",
  "Balanço":
    "Fotografia financeira da empresa num momento: tudo o que tem (Ativo) = tudo o que deve (Passivo) + capital dos sócios (Capital Próprio).",
  "Demonstração de Resultados":
    "Resumo do ano: quanto faturou (Classe 7) menos quanto gastou (Classe 6) = resultado líquido (lucro ou prejuízo).",
  "Lançamento":
    "Registo contabilístico com linhas de débito e crédito. Deve estar sempre equilibrado.",
  "Razão":
    "Livro que mostra todos os movimentos de uma conta específica, com saldo acumulado.",
  "Diário":
    "Livro onde se registam todos os lançamentos por ordem cronológica.",
  "Período Fiscal":
    "Intervalo de tempo para reporte fiscal (geralmente mensal ou trimestral).",

  /* ── Entity / Tax ───────────────────────────────────────────── */
  "CAE":
    "Código de Atividade Económica — encontra-o no certificado de início de atividade ou no Portal das Finanças.",
  "Regime de IVA":
    "Define como e quando declara o IVA. A maioria das micro empresas usa o regime trimestral.",
  "IRC":
    "Imposto sobre o Rendimento das Pessoas Coletivas — o imposto sobre o lucro da empresa, pago anualmente.",
  "IRC estimado":
    "Previsão do imposto sobre o lucro com base nos dados do ano corrente.",
  "IVA dedutível":
    "IVA que pagou nas compras e que pode descontar na declaração periódica.",
  "IVA liquidado":
    "IVA que cobrou nas vendas e que tem de entregar ao Estado.",
  "Obrigações Fiscais":
    "Prazos legais para entrega de declarações, pagamentos de impostos e outras obrigações ao Estado.",

  /* ── Inventory & Products ───────────────────────────────────── */
  "Limiar mínimo":
    "Quantidade mínima que deve ter em stock. Abaixo disto, o ingrediente aparece na lista de compras.",
  "Rutura":
    "Sem stock disponível. Necessário encomendar urgentemente.",
  "Baixo":
    "Stock abaixo do limiar mínimo. Deve reabastecer em breve.",
  "Normal":
    "Stock dentro dos valores esperados.",
  "Excesso":
    "Stock muito acima do necessário. Pode haver desperdício ou capital empatado.",
  "% Desperdício":
    "Percentagem do ingrediente que se perde na preparação (cascas, aparas, evaporação, etc.).",
  "Margem":
    "Diferença entre o preço de venda e o custo de produção, em percentagem. Margem = (PVP − Custo) ÷ PVP.",
  "PVP":
    "Preço de Venda ao Público — o valor que o cliente final paga.",

  /* ── Suppliers ───────────────────────────────────────────────── */
  "Fiabilidade":
    "Avaliação do fornecedor com base em pontualidade, qualidade e consistência das entregas.",

  /* ── Billing / Trial ────────────────────────────────────────── */
  "Trial":
    "Período de 14 dias para experimentar todas as funcionalidades sem compromisso e sem cartão de crédito.",
  "Plano Pro":
    "Subscrição profissional que desbloqueia todas as funcionalidades: reconciliação, IA, relatórios avançados e muito mais.",
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

/* ── Lightweight inline tooltip (hover only, no icon) ──────────── */

interface InlineHintProps {
  term: string;
  children: React.ReactNode;
}

/** Wraps children with a hover tooltip from the dictionary. No icon. */
export function InlineHint({ term, children }: InlineHintProps) {
  const explanation = explanations[term];
  if (!explanation) return <>{children}</>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-muted-foreground/40">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {explanation}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
