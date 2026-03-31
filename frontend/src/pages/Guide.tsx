import { PageContainer } from "@/components/layout/PageContainer";
import {
  LayoutDashboard,
  Inbox,
  FileText,
  Landmark,
  GitMerge,
  Package,
  BarChart3,
  Settings,
  Zap,
  Star,
  ArrowRight,
  Upload,
  Search,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";

/* ── Pro Tip callout ──────────────────────────────────────────────── */
function ProTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border-l-4 border-tim-gold bg-tim-gold/5 p-4">
      <Zap className="mt-0.5 h-5 w-5 shrink-0 text-tim-gold" />
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-tim-gold">
          Pro Tip
        </span>
        <p className="mt-1 text-sm text-foreground/80">{children}</p>
      </div>
    </div>
  );
}

/* ── Step list ────────────────────────────────────────────────────── */
function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {i + 1}
          </span>
          <span className="text-sm text-foreground/80 pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/* ── Section card ─────────────────────────────────────────────────── */
function GuideSection({
  icon: Icon,
  title,
  badge,
  path,
  children,
}: {
  icon: LucideIcon;
  title: string;
  badge?: string;
  path?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {title}
            </h2>
            {badge && (
              <span className="inline-block mt-0.5 rounded-full bg-tim-gold/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-tim-gold">
                {badge}
              </span>
            )}
          </div>
        </div>
        {path && (
          <NavLink
            to={path}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            Ir para
            <ArrowRight className="h-3.5 w-3.5" />
          </NavLink>
        )}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/* ── Legend ────────────────────────────────────────────────────────── */
function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 text-tim-gold" />
        Funcionalidade Pro
      </span>
      <span className="flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-tim-gold" />
        Dica do guia
      </span>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */
export default function GuidePage() {
  return (
    <PageContainer
      title="Guia do xtim.ai"
      subtitle="Tudo o que precisa para dominar a sua contabilidade"
    >
      <div className="space-y-6">
        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-tim-gold/10 via-background to-primary/5 p-8">
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-tim-gold">
              Guia Oficial
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
              Bem-vindo ao xtim.ai
            </h2>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              O xtim.ai trata da contabilidade para que se possa focar no seu
              negócio. Documentos entram, dados saem, tudo reconciliado. Este
              guia mostra-lhe como tirar o máximo partido de cada funcionalidade.
            </p>
            <Legend />
          </div>
          {/* Decorative grid */}
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-tim-gold/5" />
          <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-primary/5" />
        </div>

        {/* ── 1  PAINEL ───────────────────────────────────────────── */}
        <GuideSection
          icon={LayoutDashboard}
          title="Painel"
          badge="O seu quartel-general"
          path="/painel"
        >
          <p className="text-sm text-muted-foreground">
            O Painel dá-lhe uma visão geral instantânea: documentos pendentes,
            valor total reconciliado, e a saúde financeira do mês. É a primeira
            coisa que vê ao entrar.
          </p>
          <Steps
            items={[
              "Consulte os KPIs no topo — documentos, valores, reconciliação.",
              "Veja a atividade recente na timeline.",
              "Clique em qualquer KPI para saltar diretamente para a secção.",
            ]}
          />
          <ProTip>
            Verifique o Painel de manhã para saber exatamente o que precisa da
            sua atenção hoje.
          </ProTip>
        </GuideSection>

        {/* ── 2  CAIXA DE ENTRADA ──────────────────────────────────── */}
        <GuideSection
          icon={Inbox}
          title="Caixa de Entrada"
          badge="Submeter documentos"
          path="/caixa-entrada"
        >
          <p className="text-sm text-muted-foreground">
            Aqui é onde tudo começa. Arrasta faturas, recibos ou qualquer
            documento — o xtim.ai faz OCR automático e extrai fornecedor, NIF,
            total, IVA e data.
          </p>
          <Steps
            items={[
              "Clique em \"Importar\" ou arraste ficheiros para a zona de upload.",
              "O xtim.ai processa o documento com OCR (demora segundos).",
              "Reveja os campos extraídos e corrija se necessário.",
              "Aprove o documento para avançar para classificação.",
            ]}
          />
          <ProTip>
            Pode arrastar vários ficheiros de uma vez. PDFs e imagens (JPG, PNG)
            são suportados.
          </ProTip>
        </GuideSection>

        {/* ── 3  DOCUMENTOS ────────────────────────────────────────── */}
        <GuideSection
          icon={FileText}
          title="Documentos"
          badge="Gerir faturas e recibos"
          path="/documentos"
        >
          <p className="text-sm text-muted-foreground">
            A vista completa de todos os seus documentos. Filtre por estado,
            tipo ou fornecedor. Selecione vários para ações em massa.
          </p>
          <Steps
            items={[
              "Use os filtros no topo para encontrar documentos específicos.",
              "Clique num documento para abrir o painel de revisão lateral.",
              "Use as tabs (Todos, Revisão, Classificados, Reconciliados) para navegar por estado.",
              "Selecione vários e use \"Aprovar\" ou \"Eliminar\" em massa.",
            ]}
          />
          <ProTip>
            Documentos com o ícone de aviso precisam da sua atenção — a extração teve
            baixa confiança.
          </ProTip>
        </GuideSection>

        {/* ── 4  MOVIMENTOS ────────────────────────────────────────── */}
        <GuideSection
          icon={Landmark}
          title="Movimentos Bancários"
          badge="Importar extratos"
          path="/movimentos"
        >
          <p className="text-sm text-muted-foreground">
            Importe os seus extratos bancários para que o xtim.ai possa cruzar
            movimentos com documentos automaticamente.
          </p>
          <Steps
            items={[
              "Exporte o extrato do seu banco em CSV ou OFX.",
              "Importe na página de Movimentos.",
              "Os movimentos ficam disponíveis para reconciliação automática.",
            ]}
          />
          <ProTip>
            Quanto mais movimentos importar, melhor funciona a reconciliação
            automática.
          </ProTip>
        </GuideSection>

        {/* ── 5  RECONCILIAÇÃO ─────────────────────────────────────── */}
        <GuideSection
          icon={GitMerge}
          title="Reconciliação"
          badge="Ligar documentos a movimentos"
          path="/reconciliacao"
        >
          <p className="text-sm text-muted-foreground">
            A magia do xtim.ai. A reconciliação cruza automaticamente os seus
            documentos com os movimentos bancários — por valor e data.
          </p>
          <Steps
            items={[
              "O xtim.ai sugere correspondências automáticas (valor ±€0.01, data ±5 dias).",
              "Reveja as sugestões e aprove com um clique.",
              "Correspondências manuais também são possíveis quando o automático não acerta.",
            ]}
          />
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Como funciona
            </p>
            <p className="mt-1 text-sm text-foreground/80">
              Dois registos fazem match quando{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                |total - valor| {"<"} €0.01
              </code>{" "}
              e a diferença de datas é ≤ 5 dias.
            </p>
          </div>
          <ProTip>
            Importe documentos e movimentos do mesmo mês para os melhores
            resultados.
          </ProTip>
        </GuideSection>

        {/* ── 6  RELATÓRIOS ────────────────────────────────────────── */}
        <GuideSection
          icon={BarChart3}
          title="Relatórios"
          badge="Ver como vai o negócio"
          path="/relatorios"
        >
          <p className="text-sm text-muted-foreground">
            Demonstração de resultados, análise de IVA, gastos por fornecedor —
            tudo num sítio. Os relatórios atualizam-se automaticamente com base
            nos seus documentos.
          </p>
          <Steps
            items={[
              "Escolha o período no filtro de datas.",
              "Navegue entre os diferentes tipos de relatório.",
              "Exporte em PDF ou CSV para o seu contabilista.",
            ]}
          />
          <ProTip>
            Partilhe os relatórios mensais com o seu contabilista — poupa tempo
            a ambos.
          </ProTip>
        </GuideSection>

        {/* ── 7  INVENTÁRIO & PRODUTOS ─────────────────────────────── */}
        <GuideSection
          icon={Package}
          title="Inventário & Produtos"
          badge="Stock e receitas"
          path="/inventario"
        >
          <p className="text-sm text-muted-foreground">
            Gira os seus ingredientes, controle stock, e defina receitas com
            custos calculados automaticamente. A lista de compras gera-se
            sozinha quando o stock baixa.
          </p>
          <Steps
            items={[
              "Adicione ingredientes com unidade, stock mínimo e fornecedor.",
              "Registe entradas e saídas de stock.",
              "Crie produtos com receitas — o custo calcula-se automaticamente.",
              "Consulte a Lista de Compras para ingredientes abaixo do mínimo.",
            ]}
          />
          <ProTip>
            Defina sempre o stock mínimo — assim nunca fica sem ingredientes
            essenciais.
          </ProTip>
        </GuideSection>

        {/* ── 8  DEFINIÇÕES ────────────────────────────────────────── */}
        <GuideSection
          icon={Settings}
          title="Definições"
          badge="Configurar a sua conta"
          path="/definicoes"
        >
          <p className="text-sm text-muted-foreground">
            Configure o perfil da sua empresa, gestão de conta e plano de
            subscrição. Tudo o que precisa para personalizar o xtim.ai.
          </p>
          <Steps
            items={[
              "Vá a \"Entidade\" para definir NIF, morada e dados fiscais.",
              "Configure o seu plano em \"Definições\".",
              "Personalize o seu perfil pessoal em \"O Meu Perfil\".",
            ]}
          />
          <ProTip>
            Preencha os dados da entidade primeiro — isto melhora a
            classificação automática dos documentos.
          </ProTip>
        </GuideSection>

        {/* ── Quick reference card ─────────────────────────────────── */}
        <div className="rounded-xl border bg-gradient-to-br from-card to-muted/30 p-6">
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Atalhos Rápidos
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Navegue mais rápido com estes atalhos de teclado.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { keys: "⌘ K", label: "Abrir pesquisa rápida" },
              { keys: "↑ ↓", label: "Navegar na lista de documentos" },
              { keys: "Enter", label: "Abrir documento selecionado" },
              { keys: "Esc", label: "Fechar painel lateral" },
            ].map(({ keys, label }) => (
              <div
                key={keys}
                className="flex items-center gap-3 rounded-lg bg-background p-3"
              >
                <kbd className="inline-flex items-center rounded border bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                  {keys}
                </kbd>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pb-4 text-center text-xs text-muted-foreground">
          xtim.ai — Contabilidade Inteligente · Guia v1.0
        </div>
      </div>
    </PageContainer>
  );
}
