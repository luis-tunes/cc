import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Quote, Shield, Lock, Globe, Zap } from "lucide-react";
import { FadeIn, CountUp } from "./shared";

const TESTIMONIALS = [
  {
    quote: "Passei de 2 horas por semana a organizar papéis para 15 minutos. O xtim.ai mudou a forma como vejo a contabilidade.",
    author: "Ricardo M.",
    role: "Dono de restaurante",
    sector: "Restauração, Lisboa",
    initials: "RM",
    color: "from-amber-200 to-orange-200 dark:from-amber-900/40 dark:to-orange-900/40",
  },
  {
    quote: "Finalmente uma ferramenta em português que não precisa de um contabilista para usar. Recomendo a todos os empresários.",
    author: "Ana S.",
    role: "Gestora de loja",
    sector: "Comércio, Porto",
    initials: "AS",
    color: "from-sky-200 to-cyan-200 dark:from-sky-900/40 dark:to-cyan-900/40",
  },
  {
    quote: "A reconciliação automática é impressionante. Upload do extrato e está feito — quase tudo bate certo sem tocar em nada.",
    author: "Miguel T.",
    role: "Freelancer",
    sector: "Serviços, Braga",
    initials: "MT",
    color: "from-emerald-200 to-teal-200 dark:from-emerald-900/40 dark:to-teal-900/40",
  },
];

const METRICS = [
  { value: "500", suffix: "+", label: "documentos processados" },
  { value: "32", suffix: "", label: "empresas ativas" },
  { value: "4.9", suffix: "★", label: "satisfação média" },
];

const TRUST_BADGES = [
  { label: "RGPD Conforme", icon: Shield, color: "text-emerald-600 dark:text-emerald-400" },
  { label: "100% em Português", icon: Globe, color: "text-amber-600 dark:text-amber-400" },
  { label: "Stripe Payments", icon: Zap, color: "text-sky-600 dark:text-sky-400" },
  { label: "Dados Encriptados", icon: Lock, color: "text-orange-600 dark:text-orange-400" },
];

export function Testimonials() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    const itemWidth = el.scrollWidth / (TESTIMONIALS.length + 1);
    const idx = Math.round(el.scrollLeft / itemWidth);
    setActiveIdx(Math.min(idx, TESTIMONIALS.length));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -el.clientWidth * 0.85 : el.clientWidth * 0.85, behavior: "smooth" });
  };

  const pullQuote = TESTIMONIALS[0];

  return (
    <section className="relative py-20 sm:py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-amber-50/20 dark:via-amber-950/5 to-background" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">Testemunhos</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              O que dizem os nossos clientes
            </h2>
          </div>
        </FadeIn>

        {/* Pull quote */}
        <FadeIn delay={150}>
          <div className="mx-auto mt-12 max-w-3xl rounded-3xl bg-gradient-to-br from-amber-50/50 to-sky-50/30 dark:from-amber-950/10 dark:to-sky-950/10 border border-amber-200/30 dark:border-amber-800/20 p-8 sm:mt-16 sm:p-12 shadow-lg">
            <Quote className="h-8 w-8 text-primary/30" />
            <blockquote className="mt-4 text-xl font-medium italic leading-relaxed text-foreground/90 sm:text-2xl md:text-3xl">
              &ldquo;{pullQuote.quote}&rdquo;
            </blockquote>
            <div className="mt-6 flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${pullQuote.color} text-sm font-bold ring-2 ring-primary/10 border border-white/50 dark:border-card/50`}>
                {pullQuote.initials}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{pullQuote.author}</p>
                <p className="text-xs text-muted-foreground">{pullQuote.role} · {pullQuote.sector}</p>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Testimonial cards */}
        <div className="relative mt-10 sm:mt-12">
          {canScrollLeft && (
            <button onClick={() => scroll("left")} className="absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-2xl border-2 bg-card p-2.5 shadow-lg hover:bg-muted md:flex" aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {canScrollRight && (
            <button onClick={() => scroll("right")} className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-2xl border-2 bg-card p-2.5 shadow-lg hover:bg-muted md:flex" aria-label="Seguinte">
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          <div ref={scrollRef} className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0 md:pb-0">
            {TESTIMONIALS.slice(1).map((t, i) => (
              <FadeIn key={t.author} delay={200 + i * 100}>
                <div className="ww-island-card group relative min-w-[280px] shrink-0 snap-center p-6 md:min-w-0">
                  <div className="relative flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <svg key={s} className="h-4 w-4 fill-amber-400 text-amber-400" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <blockquote className="relative mt-4 text-sm leading-relaxed text-foreground/85 font-medium">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <div className="mt-5 flex items-center gap-3 border-t border-border/30 pt-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${t.color} text-xs font-bold ring-2 ring-primary/10 border border-white/50 dark:border-card/50`}>
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{t.author}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}

            {/* Join card */}
            <FadeIn delay={400}>
              <div className="relative min-w-[280px] shrink-0 snap-center overflow-hidden rounded-3xl border border-dashed border-primary/25 bg-gradient-to-br from-primary/[0.04] to-transparent p-6 md:min-w-0">
                <div className="flex h-full flex-col items-center justify-center text-center py-4">
                  <Zap className="h-8 w-8 text-primary/40" />
                  <p className="mt-3 text-sm font-bold text-foreground">E muitos mais...</p>
                  <p className="mt-1 text-xs text-muted-foreground">Junte-se a empresários por todo o país</p>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Mobile scroll dots */}
          <div className="mt-6 flex items-center justify-center gap-2 md:hidden">
            {[...TESTIMONIALS.slice(1), { author: "more" }].map((_, i) => (
              <div key={i} className={`rounded-full transition-all duration-300 ${activeIdx === i ? "h-2.5 w-7 bg-primary" : "h-2.5 w-2.5 bg-primary/25"}`} />
            ))}
          </div>
        </div>

        {/* Metrics */}
        <FadeIn delay={300}>
          <div className="mt-14 grid grid-cols-3 gap-4 sm:mt-16 sm:gap-6">
            {METRICS.map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-2xl font-extrabold tabular-nums text-foreground sm:text-3xl md:text-4xl">
                  <CountUp value={m.value} suffix={m.suffix} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{m.label}</p>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Trust badges */}
        <FadeIn delay={400} direction="none">
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:mt-12 sm:gap-4">
            {TRUST_BADGES.map((b) => (
              <div key={b.label} className="flex items-center gap-2 rounded-2xl border border-border/30 bg-card px-4 py-2.5 shadow-sm">
                <b.icon className={`h-4 w-4 ${b.color}`} />
                <span className="text-xs font-bold text-muted-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
