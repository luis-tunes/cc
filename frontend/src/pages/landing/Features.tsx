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
  emoji: string;
}

const FEATURES: Feature[] = [
  {
    icon: Eye,
    title: "OCR inteligente",
    description: "Digitalize faturas, recibos e notas de crédito. Extração automática de NIF, valores, IVA e datas.",
    highlight: "Extração automática",
    stat: { value: "3", prefix: "<", suffix: "s", label: "tempo médio de extração" },
    accentBg: "bg-sky-100 dark:bg-sky-900/30 group-hover:bg-sky-200 dark:group-hover:bg-sky-800/40",
    accentText: "text-sky-600 dark:text-sky-400",
    accentBadge: "border-sky-300/40 bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400",
    cssVar: "--tim-info",
    emoji: "🔭",
  },
  {
    icon: Bot,
    title: "Classificação por IA",
    description: "O xtim.ai aprende com o seu histórico e sugere contas SNC automaticamente. Aprovação com um clique.",
    highlight: "Aprende consigo",
    stat: { value: "95", prefix: ">", suffix: "%", label: "taxa de acerto" },
    accentBg: "bg-amber-100 dark:bg-amber-900/30 group-hover:bg-amber-200 dark:group-hover:bg-amber-800/40",
    accentText: "text-amber-600 dark:text-amber-400",
    accentBadge: "border-amber-300/40 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
    cssVar: "--primary",
    emoji: "🤖",
  },
  {
    icon: Receipt,
    title: "Reconciliação automática",
    description: "Associação inteligente entre documentos e movimentos bancários por valor, data e NIF.",
    highlight: "95% automático",
    accentBg: "bg-emerald-100 dark:bg-emerald-900/30 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/40",
    accentText: "text-emerald-600 dark:text-emerald-400",
    accentBadge: "border-emerald-300/40 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
    cssVar: "--tim-success",
    emoji: "⚓",
  },
  {
    icon: BarChart3,
    title: "Dashboard financeiro",
    description: "Faturação, despesas, IVA e fluxo de caixa em tempo real. Pronto para decisões.",
    highlight: "Tempo real",
    accentBg: "bg-orange-100 dark:bg-orange-900/30 group-hover:bg-orange-200 dark:group-hover:bg-orange-800/40",
    accentText: "text-orange-600 dark:text-orange-400",
    accentBadge: "border-orange-300/40 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
    cssVar: "--tim-warning",
    emoji: "🗺️",
  },
  {
    icon: TrendingUp,
    title: "Relatórios e insights",
    description: "Demonstração de resultados, análise de fornecedores e tendências — pronto para o contabilista.",
    highlight: "Exportável",
    accentBg: "bg-violet-100 dark:bg-violet-900/30 group-hover:bg-violet-200 dark:group-hover:bg-violet-800/40",
    accentText: "text-violet-600 dark:text-violet-400",
    accentBadge: "bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-300/40",
    cssVar: "--tim-purple",
    emoji: "🌊",
  },
  {
    icon: Shield,
    title: "Seguro e conforme",
    description: "Dados encriptados, RGPD. Interface 100% em português, pensada para quem não é contabilista.",
    highlight: "RGPD",
    accentBg: "bg-rose-100 dark:bg-rose-900/30 group-hover:bg-rose-200 dark:group-hover:bg-rose-800/40",
    accentText: "text-rose-600 dark:text-rose-400",
    accentBadge: "border-rose-300/40 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400",
    cssVar: "--tim-danger",
    emoji: "🛡️",
  },
];

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
      className="ww-island-card group relative h-full p-6 sm:p-7"
      style={{ "--card-accent": `var(${f.cssVar})` } as React.CSSProperties}
    >
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${f.accentBg} transition-all duration-500 group-hover:scale-110 group-hover:rotate-[-4deg]`}>
            <span className="text-2xl" role="img" aria-label={f.title}>{f.emoji}</span>
          </div>
          <span className={`rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-wide ${f.accentBadge} transition-all duration-300 group-hover:shadow-sm`}>
            {f.highlight}
          </span>
        </div>
        <h3 className="mt-5 text-lg font-black text-foreground">{f.title}</h3>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{f.description}</p>

        {f.stat && (
          <div className="mt-5 flex items-baseline gap-2 border-t-2 border-border/30 pt-4">
            <span className={`text-3xl font-black tabular-nums ${f.accentText}`}>
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
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">⚔️ Funcionalidades</p>
            <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Tudo o que precisa,{" "}
              <span className="tim-gradient-text animate-text-shimmer">nada que não precise</span>
            </h2>
            <p className="mt-5 text-base text-muted-foreground sm:text-lg">
              Ferramentas profissionais, desenhadas para serem simples.
            </p>
          </div>
        </FadeIn>

        <div className="mt-14 grid gap-5 sm:mt-16 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
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
