import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { ArrowRight, FileText, Bot, GitMerge, BarChart3, Check } from "lucide-react";
import { FadeIn, CountUp } from "./shared";

const STEPS = [
  {
    icon: FileText,
    title: "Fatura digitalizada",
    description: "O documento é processado em segundos. NIF, valores e IVA são extraídos automaticamente.",
    color: "text-tim-info",
    bg: "bg-tim-info/10",
    border: "border-tim-info/30",
  },
  {
    icon: Bot,
    title: "Classificação IA",
    description: "A inteligência artificial sugere a conta SNC baseada no seu histórico.",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
  },
  {
    icon: GitMerge,
    title: "Reconciliação automática",
    description: "O movimento bancário é associado ao documento. Valor, data e NIF confirmados.",
    color: "text-tim-warning",
    bg: "bg-tim-warning/10",
    border: "border-tim-warning/30",
  },
  {
    icon: BarChart3,
    title: "Painel atualizado",
    description: "A faturação, despesas e reconciliação atualizam-se em tempo real no dashboard.",
    color: "text-tim-success",
    bg: "bg-tim-success/10",
    border: "border-tim-success/30",
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
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.015] to-background" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Veja em ação</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              De fatura a relatório em segundos
            </h2>
            <p className="mt-5 text-base text-muted-foreground sm:text-lg">
              Acompanhe um documento desde o upload até ao dashboard.
            </p>
          </div>
        </FadeIn>

        {/* Theater: visual demo panel + step indicators */}
        <div ref={sectionRef} className="mt-14 sm:mt-20">
          {/* Main demo panel */}
          <FadeIn delay={200}>
            <div className="relative overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-black/[0.08]">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-primary/[0.04] blur-2xl" />

              {/* Top bar */}
              <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive/40" />
                  <div className="h-2.5 w-2.5 rounded-full bg-tim-warning/40" />
                  <div className="h-2.5 w-2.5 rounded-full bg-tim-success/40" />
                </div>
                <div className="ml-3 flex-1 rounded-md bg-background/60 px-4 py-1">
                  <span className="text-xs text-muted-foreground/50 font-mono">app.xtim.ai</span>
                </div>
              </div>

              {/* Content area */}
              <div className="grid gap-0 md:grid-cols-2">
                {/* Left: animated document */}
                <div className="relative flex items-center justify-center border-b p-8 md:border-b-0 md:border-r md:p-12">
                  <div className={`w-full max-w-[260px] rounded-xl border-2 bg-card p-5 shadow-lg transition-all duration-700 ${
                    activeStep >= 0 ? "border-tim-info/40 shadow-tim-info/10" : "border-border/40"
                  }`}>
                    {/* Fatura mock */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Fatura FT 2026/142</span>
                      {activeStep >= 0 && (
                        <span className="animate-in fade-in duration-500 rounded bg-tim-info/10 px-2 py-0.5 text-[10px] font-bold text-tim-info">
                          Extraído
                        </span>
                      )}
                    </div>
                    <div className="mt-3 h-px bg-border" />
                    <div className="mt-3 space-y-2">
                      <DocField label="NIF" value="509 123 456" active={activeStep >= 0} />
                      <DocField label="Valor" value="€ 1.250,00" active={activeStep >= 0} />
                      <DocField label="IVA" value="€ 287,50" active={activeStep >= 0} />
                      <DocField label="Data" value="2026-03-28" active={activeStep >= 0} />
                    </div>
                    {activeStep >= 1 && (
                      <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                        <span className="text-[10px] font-medium text-muted-foreground">Classificação IA</span>
                        <p className="mt-0.5 text-xs font-bold text-primary">Conta 62 — FSE</p>
                      </div>
                    )}
                    {activeStep >= 2 && (
                      <div className="mt-3 animate-in fade-in slide-in-from-bottom-2 duration-500 flex items-center gap-2 rounded-lg border border-tim-success/30 bg-tim-success/5 p-2.5">
                        <Check className="h-3.5 w-3.5 text-tim-success" />
                        <span className="text-xs font-bold text-tim-success">Reconciliado</span>
                      </div>
                    )}
                  </div>

                  {/* Scan line animation */}
                  {activeStep === 0 && (
                    <div className="absolute inset-x-8 md:inset-x-12 top-8 md:top-12 h-0.5 bg-gradient-to-r from-transparent via-tim-info to-transparent animate-scan-line pointer-events-none" />
                  )}
                </div>

                {/* Right: dashboard KPIs */}
                <div className="p-8 md:p-12">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">Dashboard</p>
                  <div className="space-y-3">
                    <KpiRow label="Faturação mensal" value="42.580" suffix="€" active={activeStep >= 3} accent="text-tim-success" />
                    <KpiRow label="Documentos processados" value="284" active={activeStep >= 3} accent="text-tim-info" />
                    <KpiRow label="Reconciliação" value="96" suffix="%" active={activeStep >= 3} accent="text-primary" />
                  </div>

                  {activeStep >= 3 && (
                    <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-700 rounded-xl border border-tim-success/20 bg-tim-success/5 p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tim-success/15">
                          <Check className="h-4 w-4 text-tim-success" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-tim-success">Tudo em dia</p>
                          <p className="text-[10px] text-muted-foreground">Contabilidade atualizada automaticamente</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Step indicators below */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 md:grid-cols-4 md:gap-4">
            {STEPS.map((step, i) => (
              <FadeIn key={step.title} delay={100 + i * 80}>
                <div className={`group flex items-start gap-3 rounded-xl border p-4 transition-all duration-500 ${
                  activeStep >= i
                    ? `${step.border} bg-card shadow-md`
                    : "border-border/40 bg-card/60"
                }`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all ${
                    activeStep >= i ? step.bg : "bg-muted"
                  }`}>
                    <step.icon className={`h-4 w-4 transition-colors ${activeStep >= i ? step.color : "text-muted-foreground/50"}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">{step.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground hidden sm:block">{step.description}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Post-theater CTA */}
          <FadeIn delay={400} direction="none">
            <div className="mt-10 text-center">
              <Link
                to={isSignedIn ? "/painel" : "/auth/sign-up"}
                className="group inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
              >
                Quer experimentar? Crie a sua conta em 30 segundos
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
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold transition-all duration-500 ${
        active ? "text-foreground" : "text-muted-foreground/40"
      }`}>
        {active ? value : "—"}
      </span>
    </div>
  );
}

function KpiRow({ label, value, suffix = "", active, accent }: { label: string; value: string; suffix?: string; active: boolean; accent: string }) {
  return (
    <div className={`flex items-center justify-between rounded-lg border p-3 transition-all duration-500 ${
      active ? "border-border/60 bg-card shadow-sm" : "border-transparent bg-muted/30"
    }`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-lg font-bold tabular-nums transition-colors duration-500 ${active ? accent : "text-muted-foreground/40"}`}>
        {active ? <CountUp value={value} suffix={suffix} /> : "—"}
      </span>
    </div>
  );
}
