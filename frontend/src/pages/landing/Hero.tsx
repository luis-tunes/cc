import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Upload,
  Bot,
  Receipt,
  TrendingUp,
  FileText,
  Sparkles,
} from "lucide-react";
import { FadeIn, CountUp } from "./shared";

/* ── Hero Section ────────────────────────────────────────────────────── */

export function Hero() {
  const { isSignedIn } = useAuth();
  const ctaTo = isSignedIn ? "/painel" : "/auth/sign-up";
  const ctaLabel = isSignedIn ? "Ir para o painel" : "Começar grátis";

  // Sequential pipeline animation
  const [activeStep, setActiveStep] = useState(-1);
  const pipelineRef = useRef<HTMLDivElement>(null);
  const pipelineTriggered = useRef(false);

  useEffect(() => {
    const el = pipelineRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || pipelineTriggered.current) return;
        pipelineTriggered.current = true;
        obs.disconnect();
        [0, 1, 2, 3].forEach((i) => {
          setTimeout(() => setActiveStep(i), 600 + i * 400);
        });
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const PIPELINE = [
    { icon: Upload, label: "Fatura digitalizada", status: "Extraído", color: "text-tim-info", bg: "bg-tim-info/10" },
    { icon: Bot, label: "Classificação IA", status: "Conta 62", color: "text-primary", bg: "bg-primary/10" },
    { icon: Receipt, label: "Movimento bancário", status: "Associado", color: "text-tim-warning", bg: "bg-tim-warning/10" },
    { icon: Check, label: "Reconciliação", status: "Confirmado", color: "text-tim-success", bg: "bg-tim-success/10" },
  ];

  return (
    <section className="relative overflow-hidden">
      {/* Multi-layer background */}
      <div className="absolute inset-0 tim-mesh-gradient" />
      <div className="absolute inset-0 tim-dot-grid opacity-40" />

      {/* Vivid glow blobs */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-primary/[0.12] blur-[100px] animate-hero-glow sm:-top-32 sm:h-[600px] sm:w-[900px]" />
      <div className="absolute -right-32 top-32 hidden h-[400px] w-[400px] rounded-full bg-tim-info/[0.08] blur-[80px] animate-hero-glow-right lg:block" />
      <div className="absolute -left-32 bottom-20 hidden h-[350px] w-[350px] rounded-full bg-tim-success/[0.06] blur-[80px] animate-float-slow lg:block" />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28 md:pb-32 md:pt-36">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn delay={0}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.08] px-4 py-2 shadow-sm shadow-primary/5 sm:mb-8">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Comece grátis — sem cartão de crédito
              </span>
            </div>
          </FadeIn>

          <FadeIn delay={150}>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl lg:leading-[1.05]">
              A contabilidade do seu{" "}
              <span className="relative inline-block text-primary">
                negócio
                <svg
                  className="absolute -bottom-1.5 left-0 w-full sm:-bottom-2"
                  viewBox="0 0 200 8"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 5.5C47 2 153 2 199 5.5"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                </svg>
              </span>
              <br className="hidden sm:block" />
              no{" "}
              <span className="tim-gradient-text">piloto automático</span>
            </h1>
          </FadeIn>

          <FadeIn delay={300}>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-8 sm:text-lg md:text-xl">
              Digitalize faturas, reconcilie movimentos bancários e tenha sempre a visão financeira da sua
              empresa — tudo automatizado, em português.
            </p>
          </FadeIn>

          <FadeIn delay={400}>
            <div className="mt-8 flex flex-col items-center gap-3 sm:mt-10 sm:flex-row sm:justify-center sm:gap-4">
              <Link
                to={ctaTo}
                className="tim-glow-button group relative z-10 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-1 sm:w-auto"
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#como-funciona"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/80 bg-card/50 backdrop-blur-sm px-6 py-4 text-sm font-semibold text-foreground transition-all hover:bg-card hover:border-border hover:shadow-lg sm:w-auto"
              >
                Ver como funciona
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={500} direction="none">
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground/70">
              <span className="flex items-center gap-1.5">
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-tim-success/15">
                  <Check className="h-2.5 w-2.5 text-tim-success" />
                </div>
                Sem cartão de crédito
              </span>
              <span className="flex items-center gap-1.5">
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-tim-success/15">
                  <Check className="h-2.5 w-2.5 text-tim-success" />
                </div>
                Cancele quando quiser
              </span>
              <span className="flex items-center gap-1.5">
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-tim-success/15">
                  <Check className="h-2.5 w-2.5 text-tim-success" />
                </div>
                Suporte em português
              </span>
            </div>
          </FadeIn>
        </div>

        {/* App preview — premium frosted glass mockup */}
        <FadeIn delay={600} duration={1000}>
          <div className="mx-auto mt-16 max-w-4xl sm:mt-24">
            <div className="relative rounded-2xl border border-border/60 bg-card/90 backdrop-blur-md p-1.5 shadow-2xl shadow-black/[0.12] ring-1 ring-white/20 sm:p-2">
              {/* Glow behind the card */}
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-primary/[0.06] blur-2xl" />

              {/* Browser chrome */}
              <div className="flex items-center gap-2 rounded-t-xl bg-muted/60 px-4 py-3 sm:px-5 sm:py-3.5">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-destructive/50" />
                  <div className="h-3 w-3 rounded-full bg-tim-warning/50" />
                  <div className="h-3 w-3 rounded-full bg-tim-success/50" />
                </div>
                <div className="ml-3 flex-1 rounded-md bg-background/60 px-4 py-1.5">
                  <span className="text-xs text-muted-foreground/50 font-mono">app.xtim.ai/painel</span>
                </div>
              </div>

              {/* Dashboard content */}
              <div className="rounded-b-xl bg-gradient-to-b from-muted/30 to-muted/10 p-4 sm:p-6 md:p-8 lg:p-10">
                {/* KPI row */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                  <PreviewKpi label="Faturação" value="42.580" trend="+12%" icon={TrendingUp} accentClass="text-tim-success" bgClass="bg-tim-success/10" />
                  <PreviewKpi label="Documentos" value="284" trend="Este mês" icon={FileText} accentClass="text-tim-info" bgClass="bg-tim-info/10" />
                  <PreviewKpi label="Reconciliação" value="96%" trend="Automática" icon={Check} accentClass="text-primary" bgClass="bg-primary/10" />
                </div>

                {/* Pipeline flow — animated */}
                <div ref={pipelineRef} className="mt-5 sm:mt-8">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                    {PIPELINE.map((item, i) => (
                      <div
                        key={item.label}
                        className={`group relative rounded-xl border p-3 transition-all duration-500 sm:p-4 ${
                          activeStep >= i
                            ? "border-primary/30 bg-card shadow-lg shadow-primary/[0.08]"
                            : "border-border/50 bg-card/60"
                        }`}
                      >
                        {i < 3 && (
                          <div className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 md:block">
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-500 ${
                                activeStep >= i ? "border-primary/40 bg-primary/10" : "border-border/40 bg-muted/30"
                              }`}
                            >
                              <ChevronRight
                                className={`h-3 w-3 transition-colors duration-500 ${
                                  activeStep >= i ? "text-primary" : "text-muted-foreground/30"
                                }`}
                              />
                            </div>
                          </div>
                        )}
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.bg} transition-all duration-500`}>
                          <item.icon className={`h-4 w-4 ${item.color}`} />
                        </div>
                        <p className="mt-2.5 text-xs font-medium text-foreground">{item.label}</p>
                        <p className={`mt-0.5 text-xs font-bold transition-all duration-500 ${activeStep >= i ? item.color : "text-muted-foreground/50"}`}>
                          {item.status}
                        </p>
                        {activeStep >= i && (
                          <div className="absolute -inset-px rounded-xl bg-gradient-to-b from-primary/[0.04] to-transparent pointer-events-none" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function PreviewKpi({
  label,
  value,
  trend,
  icon: Icon,
  accentClass,
  bgClass,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  bgClass: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card p-3 transition-all hover:shadow-md sm:p-4">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bgClass} sm:h-10 sm:w-10`}>
        <Icon className={`h-4 w-4 ${accentClass} sm:h-5 sm:w-5`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-lg font-bold text-foreground tabular-nums sm:text-xl md:text-2xl">
          <CountUp value={value} />
        </p>
        <p className={`text-xs font-semibold ${accentClass}`}>{trend}</p>
      </div>
    </div>
  );
}
