import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { ArrowRight, FileText, Bot, GitMerge, BarChart3, Check, Anchor } from "lucide-react";
import { FadeIn, CountUp } from "./shared";

const STEPS = [
  {
    icon: FileText,
    title: "Fatura digitalizada",
    description: "O documento é processado em segundos. NIF, valores e IVA são extraídos automaticamente.",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-100 dark:bg-sky-900/30",
    border: "border-sky-300/40",
    emoji: "📜",
  },
  {
    icon: Bot,
    title: "Classificação IA",
    description: "A inteligência artificial sugere a conta SNC baseada no seu histórico.",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    border: "border-amber-300/40",
    emoji: "🧭",
  },
  {
    icon: GitMerge,
    title: "Reconciliação automática",
    description: "O movimento bancário é associado ao documento. Valor, data e NIF confirmados.",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    border: "border-orange-300/40",
    emoji: "⚓",
  },
  {
    icon: BarChart3,
    title: "Painel atualizado",
    description: "A faturação, despesas e reconciliação atualizam-se em tempo real no dashboard.",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    border: "border-emerald-300/40",
    emoji: "🗺️",
  },
];

export function ProductTheater() {
  const { isSignedIn } = useAuth();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(-1);
  const triggered = useRef(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || triggered.current) return;
        triggered.current = true;
        obs.disconnect();
        STEPS.forEach((_, i) => {
          setTimeout(() => setActiveStep(i), 400 + i * 600);
        });
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="product-theater" className="relative py-20 sm:py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-sky-50/30 dark:via-sky-950/10 to-background" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">🚢 Veja em ação</p>
            <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl md:text-5xl">
              De fatura a relatório em segundos
            </h2>
            <p className="mt-5 text-base text-muted-foreground sm:text-lg">
              Acompanhe um documento desde o upload até ao dashboard.
            </p>
          </div>
        </FadeIn>

        <div ref={sectionRef} className="mt-14 sm:mt-20">
          <FadeIn delay={200}>
            <div className="relative overflow-hidden rounded-3xl border-3 border-foreground/[0.06] bg-card shadow-2xl shadow-black/[0.08]">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-sky-400/[0.04] dark:bg-sky-400/[0.02] blur-2xl" />

              {/* Browser chrome with Wind Waker flair */}
              <div className="flex items-center gap-2 border-b-2 border-border/30 bg-gradient-to-r from-sky-50/50 via-white/50 to-amber-50/30 dark:from-sky-950/30 dark:via-card dark:to-amber-950/10 px-5 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-rose-400/60 border border-rose-400/20" />
                  <div className="h-3 w-3 rounded-full bg-amber-400/60 border border-amber-400/20" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400/60 border border-emerald-400/20" />
                </div>
                <div className="ml-3 flex-1 rounded-lg bg-background/60 px-4 py-1.5 border border-border/30">
                  <span className="text-xs text-muted-foreground/50 font-mono">🧭 app.xtim.ai</span>
                </div>
              </div>

              {/* Content area — animated demo */}
              <div className="grid gap-0 md:grid-cols-2">
                {/* Left: animated document */}
                <div className="relative flex items-center justify-center border-b-2 md:border-b-0 md:border-r-2 border-border/20 p-8 md:p-12">
                  <div className={`w-full max-w-[280px] rounded-2xl border-3 bg-card p-5 shadow-lg transition-all duration-700 ${
                    activeStep >= 0 ? "border-sky-300/50 shadow-sky-200/20 dark:shadow-sky-900/20" : "border-border/40"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-foreground">📄 Fatura FT 2026/142</span>
                      {activeStep >= 0 && (
                        <span className="animate-in fade-in duration-500 rounded-lg bg-sky-100 dark:bg-sky-900/30 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400 border border-sky-200/50">
                          Extraído ✓
                        </span>
                      )}
                    </div>
                    <div className="mt-3 h-0.5 bg-gradient-to-r from-sky-200/50 via-border to-amber-200/50" />
                    <div className="mt-3 space-y-2">
                      <DocField label="NIF" value="509 123 456" active={activeStep >= 0} />
                      <DocField label="Valor" value="€ 1.250,00" active={activeStep >= 0} />
                      <DocField label="IVA" value="€ 287,50" active={activeStep >= 0} />
                      <DocField label="Data" value="2026-03-28" active={activeStep >= 0} />
                    </div>
                    {activeStep >= 1 && (
                      <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500 rounded-xl border-2 border-amber-300/40 bg-amber-50/50 dark:bg-amber-900/20 p-2.5">
                        <span className="text-[10px] font-medium text-muted-foreground">🧭 Classificação IA</span>
                        <p className="mt-0.5 text-xs font-black text-amber-700 dark:text-amber-400">Conta 62 — FSE</p>
                      </div>
                    )}
                    {activeStep >= 2 && (
                      <div className="mt-3 animate-in fade-in slide-in-from-bottom-2 duration-500 flex items-center gap-2 rounded-xl border-2 border-emerald-300/40 bg-emerald-50/50 dark:bg-emerald-900/20 p-2.5">
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">⚓ Reconciliado</span>
                      </div>
                    )}
                  </div>

                  {activeStep === 0 && (
                    <div className="absolute inset-x-8 md:inset-x-12 top-8 md:top-12 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-scan-line pointer-events-none" />
                  )}
                </div>

                {/* Right: dashboard KPIs */}
                <div className="p-8 md:p-12">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-5">🗺️ Dashboard</p>
                  <div className="space-y-3">
                    <KpiRow label="Faturação mensal" value="42.580" suffix="€" active={activeStep >= 3} accent="text-emerald-600 dark:text-emerald-400" />
                    <KpiRow label="Documentos processados" value="284" active={activeStep >= 3} accent="text-sky-600 dark:text-sky-400" />
                    <KpiRow label="Reconciliação" value="96" suffix="%" active={activeStep >= 3} accent="text-amber-600 dark:text-amber-400" />
                  </div>

                  {activeStep >= 3 && (
                    <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-700 rounded-2xl border-2 border-emerald-300/30 bg-emerald-50/50 dark:bg-emerald-900/20 p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                          <span className="text-lg">🏝️</span>
                        </div>
                        <div>
                          <p className="text-xs font-black text-emerald-700 dark:text-emerald-400">Tudo em dia</p>
                          <p className="text-[10px] text-muted-foreground">Contabilidade atualizada automaticamente</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Step indicators */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 md:grid-cols-4 md:gap-4">
            {STEPS.map((step, i) => (
              <FadeIn key={step.title} delay={100 + i * 80}>
                <div className={`group flex items-start gap-3 rounded-2xl border-2 p-4 transition-all duration-500 ${
                  activeStep >= i
                    ? `${step.border} bg-card shadow-lg`
                    : "border-border/30 bg-card/60"
                }`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
                    activeStep >= i ? step.bg : "bg-muted"
                  }`}>
                    <span className="text-lg">{step.emoji}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-foreground">{step.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground hidden sm:block">{step.description}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={400} direction="none">
            <div className="mt-10 text-center">
              <Link
                to={isSignedIn ? "/painel" : "/auth/sign-up"}
                className="group inline-flex items-center gap-2 text-sm font-bold text-primary transition-colors hover:text-primary/80"
              >
                🚀 Quer experimentar? Crie a sua conta em 30 segundos
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function DocField({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      <span className={`text-xs font-bold transition-all duration-500 ${
        active ? "text-foreground" : "text-muted-foreground/40"
      }`}>
        {active ? value : "—"}
      </span>
    </div>
  );
}

function KpiRow({ label, value, suffix = "", active, accent }: { label: string; value: string; suffix?: string; active: boolean; accent: string }) {
  return (
    <div className={`flex items-center justify-between rounded-xl border-2 p-3 transition-all duration-500 ${
      active ? "border-border/40 bg-card shadow-sm" : "border-transparent bg-muted/30"
    }`}>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className={`text-lg font-black tabular-nums transition-colors duration-500 ${active ? accent : "text-muted-foreground/40"}`}>
        {active ? <CountUp value={value} suffix={suffix} /> : "—"}
      </span>
    </div>
  );
}
