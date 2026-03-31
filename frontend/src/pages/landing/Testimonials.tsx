import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { FadeIn } from "./shared";

const TESTIMONIALS = [
  {
    quote:
      "Passei de 2 horas por semana a organizar papéis para 15 minutos. O xtim.ai mudou a forma como vejo a contabilidade.",
    author: "Ricardo M.",
    role: "Dono de restaurante",
    sector: "Restauração, Lisboa",
    initials: "RM",
  },
  {
    quote:
      "Finalmente uma ferramenta em português que não precisa de um contabilista para usar. Recomendo a todos os empresários.",
    author: "Ana S.",
    role: "Gestora de loja",
    sector: "Comércio, Porto",
    initials: "AS",
  },
  {
    quote:
      "A reconciliação automática é impressionante. Upload do extrato e está feito — quase tudo bate certo sem tocar em nada.",
    author: "Miguel T.",
    role: "Freelancer",
    sector: "Serviços, Braga",
    initials: "MT",
  },
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

    // Track active dot based on scroll position
    const itemWidth = el.scrollWidth / TESTIMONIALS.length;
    const idx = Math.round(el.scrollLeft / itemWidth);
    setActiveIdx(Math.min(idx, TESTIMONIALS.length - 1));
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
    const amount = el.clientWidth * 0.85;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="relative py-20 sm:py-24 md:py-32 overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.015] to-background" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Testemunhos</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              O que dizem os nossos utilizadores
            </h2>
          </div>
        </FadeIn>

        <div className="relative mt-12 sm:mt-16">
          {/* Scroll arrows (desktop) */}
          {canScrollLeft && (
            <button
              onClick={() => scroll("left")}
              className="absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border bg-card p-2.5 shadow-lg transition-all hover:bg-muted hover:shadow-xl md:flex"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-4 w-4 text-foreground" />
            </button>
          )}
          {canScrollRight && (
            <button
              onClick={() => scroll("right")}
              className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border bg-card p-2.5 shadow-lg transition-all hover:bg-muted hover:shadow-xl md:flex"
              aria-label="Seguinte"
            >
              <ChevronRight className="h-4 w-4 text-foreground" />
            </button>
          )}

          <div
            ref={scrollRef}
            className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0"
          >
            {TESTIMONIALS.map((t, i) => (
              <FadeIn key={t.author} delay={i * 120}>
                <div className="group relative min-w-[300px] max-w-[340px] shrink-0 snap-center overflow-hidden rounded-2xl border bg-card p-7 transition-all tim-card-hover md:min-w-0 md:max-w-none">
                  {/* Decorative quote mark */}
                  <Quote className="absolute -right-2 -top-2 h-24 w-24 text-primary/[0.04] transition-colors group-hover:text-primary/[0.08]" />

                  {/* Stars */}
                  <div className="relative flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <svg key={s} className="h-4 w-4 fill-primary text-primary" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>

                  {/* Quote */}
                  <blockquote className="relative mt-5 text-base leading-relaxed text-foreground/85">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>

                  {/* Author */}
                  <div className="mt-7 flex items-center gap-3 border-t border-border/60 pt-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-bold text-primary ring-2 ring-primary/10">
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{t.author}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                      <p className="text-xs font-medium text-primary/70">{t.sector}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Mobile scroll dots — with active tracking */}
          <div className="mt-6 flex items-center justify-center gap-2.5 md:hidden">
            {TESTIMONIALS.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  activeIdx === i
                    ? "h-2 w-6 bg-primary"
                    : "h-2 w-2 bg-primary/25"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
