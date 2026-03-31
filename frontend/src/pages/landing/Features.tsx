import { Eye, Bot, Receipt, BarChart3, TrendingUp, Shield } from "lucide-react";
import { FadeIn, CountUp } from "./shared";

const FEATURES: {
  icon: typeof Eye;
  title: string;
  description: string;
  highlight: string;
  large: boolean;
  stat?: { value: string; suffix: string; label: string };
  accent: string;
  accentBg: string;
  accentText: string;
  accentBadge: string;
  borderAccent: string;
}[] = [
  {
    icon: Eye,
    title: "OCR inteligente",
    description: "Digitalize faturas, recibos e notas de crédito. Extração automática de NIF, valores, IVA e datas.",
    highlight: "Extração automática",
    large: true,
    stat: { value: "30", suffix: "s", label: "tempo médio de extração" },
    accent: "from-tim-info/10 to-tim-info/[0.02]",
    accentBg: "bg-tim-info/10 group-hover:bg-tim-info/20",
    accentText: "text-tim-info",
    accentBadge: "border-tim-info/20 bg-tim-info/[0.08] text-tim-info",
    borderAccent: "border-l-tim-info/40",
  },
  {
    icon: Bot,
    title: "Classificação por IA",
    description: "O xtim.ai aprende com o seu histórico e sugere contas SNC automaticamente. Aprovação com um clique.",
    highlight: "Aprende consigo",
    large: true,
    stat: { value: "95", suffix: "%", label: "taxa de acerto" },
    accent: "from-primary/10 to-primary/[0.02]",
    accentBg: "bg-primary/10 group-hover:bg-primary/20",
    accentText: "text-primary",
    accentBadge: "border-primary/20 bg-primary/[0.08] text-primary",
    borderAccent: "border-l-primary/40",
  },
  {
    icon: Receipt,
    title: "Reconciliação automática",
    description: "Associação inteligente entre documentos e movimentos bancários por valor, data e NIF.",
    highlight: "95% automático",
    large: false,
    accent: "from-tim-success/10 to-tim-success/[0.02]",
    accentBg: "bg-tim-success/10 group-hover:bg-tim-success/20",
    accentText: "text-tim-success",
    accentBadge: "border-tim-success/20 bg-tim-success/[0.08] text-tim-success",
    borderAccent: "border-l-tim-success/40",
  },
  {
    icon: BarChart3,
    title: "Dashboard financeiro",
    description: "Faturação, despesas, IVA e fluxo de caixa em tempo real. Pronto para decisões.",
    highlight: "Tempo real",
    large: false,
    accent: "from-tim-warning/10 to-tim-warning/[0.02]",
    accentBg: "bg-tim-warning/10 group-hover:bg-tim-warning/20",
    accentText: "text-tim-warning",
    accentBadge: "border-tim-warning/20 bg-tim-warning/[0.08] text-tim-warning",
    borderAccent: "border-l-tim-warning/40",
  },
  {
    icon: TrendingUp,
    title: "Relatórios e insights",
    description: "Demonstração de resultados, análise de fornecedores e tendências — pronto para o contabilista.",
    highlight: "Exportável",
    large: false,
    accent: "from-[hsl(270_60%_55%)]/10 to-[hsl(270_60%_55%)]/[0.02]",
    accentBg: "bg-[hsl(270_60%_55%)]/10 group-hover:bg-[hsl(270_60%_55%)]/20",
    accentText: "text-[hsl(270_60%_55%)]",
    accentBadge: "bg-[hsl(270_60%_55%)]/[0.08] text-[hsl(270_60%_55%)] border-[hsl(270_60%_55%)]/20",
    borderAccent: "border-l-[hsl(270_60%_55%)]/40",
  },
  {
    icon: Shield,
    title: "Seguro e conforme",
    description: "Dados encriptados, RGPD. Interface 100% em português, pensada para quem não é contabilista.",
    highlight: "RGPD",
    large: false,
    accent: "from-tim-danger/8 to-tim-danger/[0.02]",
    accentBg: "bg-tim-danger/10 group-hover:bg-tim-danger/20",
    accentText: "text-tim-danger",
    accentBadge: "border-tim-danger/20 bg-tim-danger/[0.08] text-tim-danger",
    borderAccent: "border-l-tim-danger/40",
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

        <div className="mt-14 grid gap-4 sm:mt-16 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 80}>
              <div
                className={`group relative h-full overflow-hidden rounded-2xl border border-l-2 ${f.borderAccent} bg-card p-6 transition-all tim-card-hover sm:p-7 ${
                  f.large ? "lg:col-span-2" : ""
                }`}
              >
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

                  {/* Embedded stat for large cards */}
                  {f.stat && (
                    <div className="mt-5 flex items-baseline gap-2 border-t border-border/50 pt-4">
                      <span className={`text-3xl font-extrabold tabular-nums ${f.accentText}`}>
                        {"<"}<CountUp value={f.stat.value} suffix={f.stat.suffix} />
                      </span>
                      <span className="text-xs text-muted-foreground">{f.stat.label}</span>
                    </div>
                  )}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
