import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { ArrowRight, Sparkles, Compass, Wind, Anchor } from "lucide-react";
import { FadeIn } from "./shared";

export function Hero() {
  const { isSignedIn } = useAuth();
  const ctaTo = isSignedIn ? "/painel" : "/auth/sign-up";
  const ctaLabel = isSignedIn ? "Ir para o painel" : "Experimentar grátis";

  return (
    <section className="relative overflow-hidden min-h-[90vh] flex items-center">
      {/* Sky + ocean gradient */}
      <div className="absolute inset-0 ww-sky" />

      {/* Animated clouds */}
      <div className="absolute top-[8%] left-0 w-full pointer-events-none overflow-hidden" aria-hidden="true">
        <svg className="animate-cloud-float opacity-[0.35]" width="200" height="60" viewBox="0 0 200 60" fill="none">
          <ellipse cx="100" cy="35" rx="80" ry="25" fill="hsl(0 0% 100% / 0.8)" />
          <ellipse cx="60" cy="30" rx="50" ry="22" fill="hsl(0 0% 100% / 0.9)" />
          <ellipse cx="140" cy="32" rx="45" ry="20" fill="hsl(0 0% 100% / 0.85)" />
        </svg>
      </div>
      <div className="absolute top-[18%] left-0 w-full pointer-events-none overflow-hidden" aria-hidden="true">
        <svg className="animate-cloud-float-reverse opacity-[0.2]" width="180" height="50" viewBox="0 0 180 50" fill="none">
          <ellipse cx="90" cy="28" rx="70" ry="22" fill="hsl(0 0% 100% / 0.7)" />
          <ellipse cx="50" cy="25" rx="45" ry="18" fill="hsl(0 0% 100% / 0.8)" />
          <ellipse cx="130" cy="26" rx="40" ry="17" fill="hsl(0 0% 100% / 0.75)" />
        </svg>
      </div>

      {/* Ocean glow blobs */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-sky-400/[0.12] blur-[100px] animate-hero-glow sm:-top-32 sm:h-[600px] sm:w-[900px]" />
      <div className="absolute -right-32 top-32 hidden h-[400px] w-[400px] rounded-full bg-emerald-400/[0.08] blur-[80px] animate-hero-glow-right lg:block" />

      {/* Floating compass badge */}
      <div className="pointer-events-none absolute right-[8%] top-[20%] hidden xl:block animate-ocean-drift">
        <div className="rounded-2xl border-2 border-sky-300/20 bg-white/70 dark:bg-card/70 backdrop-blur-sm px-4 py-3 shadow-xl">
          <div className="flex items-center gap-2.5">
            <Compass className="h-5 w-5 text-sky-500 animate-sail-sway" />
            <div>
              <span className="text-sm font-extrabold text-sky-600 dark:text-sky-400">&lt;3s</span>
              <span className="text-[10px] text-muted-foreground ml-1.5">extração</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating wind badge */}
      <div className="pointer-events-none absolute left-[6%] top-[40%] hidden xl:block animate-wave-bob">
        <div className="rounded-2xl border-2 border-emerald-300/20 bg-white/70 dark:bg-card/70 backdrop-blur-sm px-4 py-3 shadow-xl">
          <div className="flex items-center gap-2.5">
            <Wind className="h-5 w-5 text-emerald-500" />
            <div>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">95%</span>
              <span className="text-[10px] text-muted-foreground ml-1.5">automático</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating anchor badge */}
      <div className="pointer-events-none absolute left-[12%] bottom-[25%] hidden xl:block animate-ocean-drift" style={{ animationDelay: "3s" }}>
        <div className="rounded-2xl border-2 border-amber-300/20 bg-white/70 dark:bg-card/70 backdrop-blur-sm px-4 py-3 shadow-xl">
          <div className="flex items-center gap-2.5">
            <Anchor className="h-5 w-5 text-amber-500" />
            <div>
              <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">500+</span>
              <span className="text-[10px] text-muted-foreground ml-1.5">docs processados</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pb-28 sm:pt-28 md:pb-36 md:pt-36">
        <div className="mx-auto max-w-3xl text-center">
          <FadeIn delay={0}>
            <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border-2 border-primary/30 bg-white/60 dark:bg-card/60 backdrop-blur-sm px-5 py-2.5 shadow-lg sm:mb-8">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Navegue a contabilidade com IA
              </span>
            </div>
          </FadeIn>

          <FadeIn delay={150}>
            <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl lg:leading-[1.05]">
              As suas faturas.{" "}
              <br className="hidden sm:block" />
              <span className="text-sky-600 dark:text-sky-400">Organizadas.</span>{" "}
              <span className="relative inline-block">
                <span className="tim-gradient-text animate-text-shimmer">Automaticamente.</span>
                <svg
                  className="absolute -bottom-2 left-0 w-full sm:-bottom-3"
                  viewBox="0 0 300 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 8C20 2 40 10 60 6C80 2 100 10 120 6C140 2 160 10 180 6C200 2 220 10 240 6C260 2 280 10 298 6"
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
              Digitalize, classifique e reconcilie documentos fiscais em menos de 3 segundos — com IA, 100% em português.
            </p>
          </FadeIn>

          <FadeIn delay={400}>
            <div className="mt-8 flex flex-col items-center gap-3 sm:mt-10 sm:flex-row sm:justify-center sm:gap-4">
              <Link
                to={ctaTo}
                className="tim-glow-button group relative z-10 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-9 py-4 text-base font-black text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-1.5 hover:scale-[1.02] sm:w-auto min-h-[52px]"
              >
                {ctaLabel}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1.5" />
              </Link>
              <a
                href="#product-theater"
                className="flex w-full items-center justify-center gap-2 text-sm font-bold text-muted-foreground underline-offset-4 hover:underline hover:text-foreground transition-colors sm:w-auto"
              >
                Ver como funciona ↓
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={500} direction="none">
            <p className="mt-6 text-sm text-muted-foreground/70 font-medium">
              Sem cartão de crédito · Pronto em 30 segundos
            </p>
          </FadeIn>

          <FadeIn delay={600} direction="none">
            <p className="mt-2 text-sm text-muted-foreground/60 font-medium">
              Restauração · Comércio · Serviços · Hotelaria — 100% em português
            </p>
          </FadeIn>
        </div>
      </div>

      {/* Ocean wave at bottom */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" preserveAspectRatio="none">
          <path d="M0 80C240 20 480 100 720 60C960 20 1200 100 1440 60V120H0V80Z" fill="hsl(var(--background))" fillOpacity="0.8" />
          <path d="M0 90C200 50 400 110 600 70C800 30 1000 100 1200 60C1300 40 1380 70 1440 55V120H0V90Z" fill="hsl(var(--background))" />
        </svg>
      </div>
    </section>
  );
}
