import { useRef } from "react";
import { Eye, Bot, Receipt, BarChart3, TrendingUp, Shield } from "lucide-react";
import { FadeIn, CountUp } from "./shared";

interface Feature {
  icon: typeof Eye;
  title: string;
  description: string;
  highlight: string;
  stat?: { value: string; prefix: string; suffix: string; label: string };
  accentBg: string;
  accentText: string;
  accentBadge: string;
  cssVar: string;
}

const FEATURES: Feature[] = [
  {
    icon: Eye,
    title: "OCR inteligente",
    description: "Digitalize faturas, recibos e notas de crédito. Extração automática de NIF, valores, IVA e datas.",
    highlight: "Extração automática",
    stat: { value: "30", prefix: "<", suffix: "s", label: "tempo médio de extração" },
    accentBg: "bg-tim-info/10 group-hover:bg-tim-info/20",
    accentText: "text-tim-info",
    accentBadge: "border-tim-info/20 bg-tim-info/[0.08] text-tim-info",
    cssVar: "--tim-info",
  },
  {
    icon: Bot,
    title: "Classificação por IA",
    description: "O xtim.ai aprende com o seu histórico e sugere contas SNC automaticamente. Aprovação com um clique.",
    highlight: "Aprende consigo",
    stat: { value: "95", prefix: ">", suffix: "%", label: "taxa de acerto" },
    accentBg: "bg-primary/10 group-hover:bg-primary/20",
    accentText: "text-primary",
    accentBadge: "border-primary/20 bg-primary/[0.08] text-primary",
    cssVar: "--primary",
  },
  {
    icon: Receipt,
    title: "Reconciliação automática",
    description: "Associação inteligente entre documentos e movimentos bancários por valor, data e NIF.",
    highlight: "95% automático",
    accentBg: "bg-tim-success/10 group-hover:bg-tim-success/20",
    accentText: "text-tim-success",
    accentBadge: "border-tim-success/20 bg-tim-success/[0.08] text-tim-success",
    cssVar: "--tim-success",
  },
  {
    icon: BarChart3,
    title: "Dashboard financeiro",
    description: "Faturação, despesas, IVA e fluxo de caixa em tempo real. Pronto para decisões.",
    highlight: "Tempo real",
    accentBg: "bg-tim-warning/10 group-hover:bg-tim-warning/20",
    accentText: "text-tim-warning",
    accentBadge: "border-tim-warning/20 bg-tim-warning/[0.08] text-tim-warning",
    cssVar: "--tim-warning",
  },
  {
    icon: TrendingUp,
    title: "Relatórios e insights",
    description: "Demonstração de resultados, análise de fornecedores e tendências — pronto para o contabilista.",
    highlight: "Exportável",
    accentBg: "bg-tim-purple/10 group-hover:bg-tim-purple/20",
    accentText: "text-tim-purple",
    accentBadge: "bg-tim-purple/[0.08] text-tim-purple border-tim-purple/20",
    cssVar: "--tim-purple",
  },
  {
    icon: Shield,
    title: "Seguro e conforme",
    description: "Dados encriptados, RGPD. Interface 100% em português, pensada para quem não é contabilista.",
    highlight: "RGPD",
    accentBg: "bg-tim-danger/10 group-hover:bg-tim-danger/20",
    accentText: "text-tim-danger",
    accentBadge: "border-tim-danger/20 bg-tim-danger/[0.08] text-tim-danger",
    cssVar: "--tim-danger",
  },
];

/* ── Card with mouse-tracking spotlight (Vercel/Linear style) ──── */

function FeatureCard({ feature: f }: { feature: Feature }) {
  const ref = useRef<HTMLDivElement>(null);

  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      className="feature-card group relative h-full overflow-hidden rounded-2xl border border-border/50 bg-card p-6 sm:p-7"
      style={{ "--card-accent": `var(${f.cssVar})` } as React.CSSProperties}
    >
      {/* Mouse-tracking inner glow */}
      <div className="feature-card-spotlight" />
      {/* Mouse-tracking border highlight */}
      <div className="feature-card-border-glow" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${f.accentBg} transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg`}>
            <f.icon className={`h-5 w-5 ${f.accentText} transition-transform duration-700 group-hover:scale-110`} />
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${f.accentBadge} transition-all duration-300 group-hover:shadow-sm`}>
            {f.highlight}
          </span>
        </div>
        <h3 className="mt-5 text-lg font-bold text-foreground">{f.title}</h3>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{f.description}</p>

        {f.stat && (
          <div className="mt-5 flex items-baseline gap-2 border-t border-border/50 pt-4">
            <span className={`text-3xl font-extrabold tabular-nums ${f.accentText}`}>
              {f.stat.prefix}<CountUp value={f.stat.value} suffix={f.stat.suffix} />
            </span>
            <span className="text-xs text-muted-foreground">{f.stat.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="funcionalidades" className="relative py-20 sm:py-24 md:py-32 overflow-hidden">
      {/* Subtle dot grid background */}
      <div className="absolute inset-0 tim-dot-grid opacity-30 pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Funcionalidades</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Tudo o que precisa,{" "}
              <span className="tim-gradient-text animate-text-shimmer">nada que não precise</span>
            </h2>
            <p className="mt-5 text-base text-muted-foreground sm:text-lg">
              Ferramentas profissionais, desenhadas para serem simples.
            </p>
          </div>
        </FadeIn>

        <div className="mt-14 grid gap-4 sm:mt-16 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 80}>
              <FeatureCard feature={f} />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
