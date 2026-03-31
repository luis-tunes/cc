import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";
import { FadeIn } from "./shared";

export function Hero() {
  const { isSignedIn } = useAuth();
  const ctaTo = isSignedIn ? "/painel" : "/auth/sign-up";
  const ctaLabel = isSignedIn ? "Ir para o painel" : "Experimentar grátis";

  return (
    <section className="relative overflow-hidden">
      {/* Background: mesh gradient + 2 glow blobs */}
      <div className="absolute inset-0 tim-mesh-gradient" />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-primary/[0.10] blur-[100px] animate-hero-glow sm:-top-32 sm:h-[600px] sm:w-[900px]" />
      <div className="absolute -right-32 top-32 hidden h-[400px] w-[400px] rounded-full bg-tim-info/[0.07] blur-[80px] animate-hero-glow-right lg:block" />

      {/* Ghost receipt — atmospheric */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[400px] rotate-3 rounded-xl border border-foreground/[0.03] bg-foreground/[0.02] blur-[2px] opacity-[0.04] pointer-events-none animate-ghost-float sm:w-[340px] sm:h-[460px]">
        <div className="p-6 space-y-4">
          <div className="h-3 w-24 rounded bg-foreground/20" />
          <div className="h-2 w-full rounded bg-foreground/10" />
          <div className="h-2 w-3/4 rounded bg-foreground/10" />
          <div className="mt-6 h-2 w-1/2 rounded bg-foreground/15" />
          <div className="h-2 w-2/3 rounded bg-foreground/10" />
          <div className="mt-6 h-4 w-20 rounded bg-foreground/20" />
        </div>
      </div>

      {/* Floating stat badges — cinematic desktop accents */}
      <div className="pointer-events-none absolute left-[6%] top-[32%] hidden animate-float-badge-1 xl:block">
        <div className="rounded-xl border border-tim-info/20 bg-card/80 backdrop-blur-sm px-4 py-2.5 shadow-lg shadow-tim-info/5">
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-tim-info animate-pulse" />
            <span className="text-sm font-extrabold tabular-nums text-tim-info">&lt;30s</span>
            <span className="text-[10px] text-muted-foreground">extração</span>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute right-[6%] top-[48%] hidden animate-float-badge-2 xl:block">
        <div className="rounded-xl border border-tim-success/20 bg-card/80 backdrop-blur-sm px-4 py-2.5 shadow-lg shadow-tim-success/5">
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-tim-success animate-pulse" />
            <span className="text-sm font-extrabold tabular-nums text-tim-success">95%</span>
            <span className="text-[10px] text-muted-foreground">automático</span>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute left-[10%] bottom-[22%] hidden animate-float-badge-3 xl:block">
        <div className="rounded-xl border border-primary/20 bg-card/80 backdrop-blur-sm px-4 py-2.5 shadow-lg shadow-primary/5">
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-extrabold tabular-nums text-primary">500+</span>
            <span className="text-[10px] text-muted-foreground">docs processados</span>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pb-28 sm:pt-28 md:pb-36 md:pt-36">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn delay={0}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.08] px-4 py-2 shadow-sm shadow-primary/5 sm:mb-8">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                IA para contabilidade portuguesa
              </span>
            </div>
          </FadeIn>

          <FadeIn delay={150}>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl lg:leading-[1.05]">
              Todas as suas faturas.{" "}
              <br className="hidden sm:block" />
              Organizadas.{" "}
              <span className="relative inline-block">
                <span className="tim-gradient-text animate-text-shimmer">Automaticamente.</span>
                <svg
                  className="absolute -bottom-1.5 left-0 w-full sm:-bottom-2"
                  viewBox="0 0 280 8"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 5.5C65 2 215 2 279 5.5"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="animate-draw-in"
                  />
                </svg>
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={300}>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-8 sm:text-lg md:text-xl">
              Digitalize, classifique e reconcilie documentos fiscais com IA — em português, para negócios portugueses.
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
                href="#product-theater"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/80 bg-card/50 backdrop-blur-sm px-6 py-4 text-sm font-semibold text-foreground transition-all hover:bg-card hover:border-border hover:shadow-lg sm:w-auto"
              >
                Ver em 60 segundos
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={500} direction="none">
            <p className="mt-8 text-sm text-muted-foreground/60">
              Restauração · Comércio · Serviços · Hotelaria — 100% em português · Sem cartão de crédito
            </p>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
