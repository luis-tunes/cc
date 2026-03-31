import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { ArrowRight, ChevronRight, Sparkles, Users } from "lucide-react";
import { FadeIn } from "./shared";

export function CTA() {
  const { isSignedIn } = useAuth();

  return (
    <section className="relative overflow-hidden tim-dark-section py-24 sm:py-28 md:py-36">
      {/* Background glow orbs */}
      <div className="absolute -left-32 top-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/[0.08] blur-[120px]" />
      <div className="absolute -right-32 top-1/4 h-[400px] w-[400px] rounded-full bg-tim-info/[0.06] blur-[100px]" />
      <div className="absolute inset-0 tim-dot-grid opacity-10" />

      <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
        <FadeIn>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 shadow-lg shadow-primary/10 sm:h-18 sm:w-18">
            <Sparkles className="h-8 w-8 text-primary sm:h-9 sm:w-9" />
          </div>
          <h2 className="mt-8 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
            <span className="tim-gradient-text-light">Comece a poupar tempo hoje</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base text-[hsl(210_10%_65%)] sm:text-lg">
            Carregue os seus documentos e extratos. Veja o xtim.ai a trabalhar. Decida depois.
          </p>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-5">
            <Link
              to={isSignedIn ? "/painel" : "/auth/sign-up"}
              className="tim-glow-button group relative z-10 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-9 py-4 text-base font-bold text-primary-foreground shadow-2xl shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-1 sm:w-auto"
            >
              {isSignedIn ? "Ir para o painel" : "Criar conta grátis — 14 dias sem compromisso"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="mailto:info@xtim.ai"
              className="flex items-center gap-2 text-sm font-semibold text-[hsl(210_10%_70%)] transition-colors hover:text-white"
            >
              Falar com a equipa
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={350} direction="none">
          <div className="mt-10 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5">
            <Users className="h-4 w-4 text-primary/80" />
            <span className="text-sm text-[hsl(210_10%_65%)]">
              Centenas de empresários portugueses já poupam horas por semana
            </span>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
