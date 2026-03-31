import {
  Eye,
  Bot,
  Receipt,
  BarChart3,
  TrendingUp,
  Shield,
  Utensils,
  Store,
  Briefcase,
  Hotel,
  HardHat,
  HeartPulse,
} from "lucide-react";
import { FadeIn } from "./shared";

/* ── Sectors strip ─────────────────────────────────────────────────── */

const SECTORS = [
  { label: "Restauração", icon: Utensils },
  { label: "Comércio", icon: Store },
  { label: "Serviços", icon: Briefcase },
  { label: "Hotelaria", icon: Hotel },
  { label: "Construção", icon: HardHat },
  { label: "Saúde", icon: HeartPulse },
];

export function Sectors() {
  return (
    <section className="border-y bg-muted/30 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
            Pensado para negócios portugueses
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 sm:mt-10 sm:grid-cols-6 sm:gap-4">
            {SECTORS.map((sector) => (
              <div
                key={sector.label}
                className="group flex flex-col items-center gap-2.5 rounded-xl border border-transparent bg-card/60 px-3 py-4 text-center transition-all hover:border-primary/20 hover:bg-card hover:shadow-md sm:py-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 transition-all group-hover:bg-primary/15 group-hover:scale-110">
                  <sector.icon className="h-5 w-5 text-primary/70 transition-colors group-hover:text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                  {sector.label}
                </span>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── Features — Bento grid with unique accents ─────────────────────── */

const FEATURES: {
  icon: typeof Eye;
  title: string;
  description: string;
  highlight: string;
  large: boolean;
  accent: string;
  accentBg: string;
  accentText: string;
  accentBadge: string;
}[] = [
  {
    icon: Eye,
    title: "OCR inteligente",
    description:
      "Digitalize faturas, recibos e notas de crédito. Extração automática de NIF, valores, IVA e datas com reconhecimento ótico avançado.",
    highlight: "< 30 segundos",
    large: true,
    accent: "from-tim-info/10 to-tim-info/[0.02]",
    accentBg: "bg-tim-info/10 group-hover:bg-tim-info/20",
    accentText: "text-tim-info",
    accentBadge: "border-tim-info/20 bg-tim-info/[0.08] text-tim-info",
  },
  {
    icon: Bot,
    title: "Classificação por IA",
    description:
      "O xtim.ai aprende com o seu histórico e sugere contas SNC automaticamente. Aprovação com um clique.",
    highlight: "Aprende consigo",
    large: true,
    accent: "from-primary/10 to-primary/[0.02]",
    accentBg: "bg-primary/10 group-hover:bg-primary/20",
    accentText: "text-primary",
    accentBadge: "border-primary/20 bg-primary/[0.08] text-primary",
  },
  {
    icon: Receipt,
    title: "Reconciliação automática",
    description:
      "Associação inteligente entre documentos e movimentos bancários por valor e data. Taxa de correspondência média de 95%.",
    highlight: "95% automático",
    large: false,
    accent: "from-tim-success/10 to-tim-success/[0.02]",
    accentBg: "bg-tim-success/10 group-hover:bg-tim-success/20",
    accentText: "text-tim-success",
    accentBadge: "border-tim-success/20 bg-tim-success/[0.08] text-tim-success",
  },
  {
    icon: BarChart3,
    title: "Dashboard financeiro",
    description:
      "Visão completa do estado financeiro: faturação, despesas, IVA a entregar e fluxo de caixa em tempo real.",
    highlight: "Tempo real",
    large: false,
    accent: "from-tim-warning/10 to-tim-warning/[0.02]",
    accentBg: "bg-tim-warning/10 group-hover:bg-tim-warning/20",
    accentText: "text-tim-warning",
    accentBadge: "border-tim-warning/20 bg-tim-warning/[0.08] text-tim-warning",
  },
  {
    icon: TrendingUp,
    title: "Relatórios e insights",
    description:
      "Demonstração de resultados, análise de fornecedores e tendências — pronto para o seu contabilista.",
    highlight: "Pronto a exportar",
    large: false,
    accent: "from-[hsl(270_60%_55%)]/10 to-[hsl(270_60%_55%)]/[0.02]",
    accentBg: "bg-[hsl(270_60%_55%)]/10 group-hover:bg-[hsl(270_60%_55%)]/20",
    accentText: "text-[hsl(270_60%_55%)]",
    accentBadge: "border-[hsl(270_60%_55%)]/20 bg-[hsl(270_60%_55%)]/[0.08] text-[hsl(270_60%_55%)]",
  },
  {
    icon: Shield,
    title: "Seguro e conforme",
    description:
      "Dados encriptados, em conformidade com RGPD. Interface 100% em português, pensada para quem não é contabilista.",
    highlight: "RGPD",
    large: false,
    accent: "from-tim-danger/8 to-tim-danger/[0.02]",
    accentBg: "bg-tim-danger/10 group-hover:bg-tim-danger/20",
    accentText: "text-tim-danger",
    accentBadge: "border-tim-danger/20 bg-tim-danger/[0.08] text-tim-danger",
  },
];

export function Features() {
  return (
    <section id="funcionalidades" className="py-20 sm:py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Funcionalidades</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Tudo o que precisa, nada que não precise
            </h2>
            <p className="mt-5 text-base text-muted-foreground sm:text-lg">
              Ferramentas profissionais, desenhadas para serem simples.
            </p>
          </div>
        </FadeIn>

        {/* Bento grid: 2 large cards on top, 4 small cards below */}
        <div className="mt-14 grid gap-4 sm:mt-16 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 80}>
              <div
                className={`group relative h-full overflow-hidden rounded-2xl border bg-card p-6 transition-all tim-card-hover sm:p-7 ${
                  f.large ? "lg:col-span-2" : ""
                }`}
              >
                {/* Gradient accent overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${f.accent} opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />

                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${f.accentBg} transition-all duration-300`}>
                      <f.icon className={`h-5 w-5 ${f.accentText}`} />
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${f.accentBadge}`}>
                      {f.highlight}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-foreground">{f.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
