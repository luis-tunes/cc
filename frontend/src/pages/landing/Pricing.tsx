import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { ArrowRight, Check, ChevronDown, CreditCard, Lock } from "lucide-react";
import { FadeIn } from "./shared";

const FAQS = [
  {
    q: "Preciso de conhecimentos de contabilidade?",
    a: "Não. O xtim.ai foi desenhado para empresários, não para contabilistas. A interface explica tudo em linguagem simples.",
  },
  {
    q: "Os meus dados estão seguros?",
    a: "Sim. Utilizamos encriptação em trânsito e em repouso, em conformidade com o RGPD. Os seus dados nunca são partilhados com terceiros.",
  },
  {
    q: "Posso experimentar antes de pagar?",
    a: "Crie uma conta gratuita e carregue o primeiro documento. Veja o xtim.ai a extrair dados automaticamente. Para tudo ilimitado, subscreva o plano Pro.",
  },
  {
    q: "Funciona com o meu banco?",
    a: "O xtim.ai aceita extratos bancários em formato CSV, suportado pela maioria dos bancos portugueses. Basta exportar e carregar.",
  },
  {
    q: "Preciso de inserir cartão de crédito?",
    a: "Não. A conta gratuita não requer qualquer pagamento. Só insere dados de pagamento quando decidir subscrever o plano Pro.",
  },
];

function AccordionItem({
  faq,
  isOpen,
  onToggle,
}: {
  faq: { q: string; a: string };
  isOpen: boolean;
  onToggle: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  const measure = useCallback(() => {
    if (contentRef.current) setHeight(contentRef.current.scrollHeight);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div className={`rounded-xl border transition-all duration-300 ${isOpen ? "border-primary/20 bg-primary/[0.02] shadow-sm" : "border-transparent bg-transparent hover:bg-muted/30"}`}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
        aria-expanded={isOpen}
      >
        <span className={`text-sm font-semibold transition-colors ${isOpen ? "text-foreground" : "text-foreground/80"}`}>{faq.q}</span>
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${isOpen ? "bg-primary/10 rotate-180" : "bg-muted"}`}>
          <ChevronDown className={`h-4 w-4 transition-colors ${isOpen ? "text-primary" : "text-muted-foreground"}`} />
        </div>
      </button>
      <div style={{ maxHeight: isOpen ? height : 0 }} className="overflow-hidden transition-[max-height] duration-300 ease-in-out">
        <div ref={contentRef} className="px-5 pb-5 sm:px-6 sm:pb-6">
          <p className="text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  "Documentos e OCR ilimitados",
  "Reconciliação automática",
  "Classificação por IA",
  "Dashboard e relatórios",
  "Multi-utilizador",
  "Suporte em português",
  "Exportação para contabilista",
];

export function Pricing() {
  const { isSignedIn } = useAuth();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="precos" className="relative py-20 sm:py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Preços</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Simples e transparente
            </h2>
            <p className="mt-5 text-base text-muted-foreground sm:text-lg">
              Um plano. Tudo incluído. Sem surpresas.
            </p>
          </div>
        </FadeIn>

        {/* Side-by-side: Pricing + FAQ */}
        <div className="mt-14 grid gap-10 sm:mt-16 lg:grid-cols-2 lg:gap-12 lg:items-start">
          {/* Pricing card — sticky on desktop */}
          <FadeIn>
            <div className="lg:sticky lg:top-24">
              <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-card p-7 shadow-2xl shadow-primary/10 sm:p-9">
                <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/[0.08] blur-xl" />
                <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-tim-success/[0.06] blur-xl" />

                <div className="relative">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-extrabold text-foreground">Profissional</h3>
                    <span className="rounded-full border border-primary/30 bg-primary/[0.08] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-primary">
                      Preço de lançamento
                    </span>
                  </div>

                  <div className="mt-6">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">A partir de</span>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-lg text-muted-foreground/50 line-through">&euro;250</span>
                      <span className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">&euro;150</span>
                      <span className="text-base text-muted-foreground">/mês + IVA</span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Menos de 5&euro;/dia — menos do que um café e pastel de nata
                    </p>
                  </div>

                  <div className="mt-7 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                  <ul className="mt-7 space-y-3">
                    {FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm">
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tim-success/15">
                          <Check className="h-3 w-3 text-tim-success" />
                        </div>
                        <span className="text-foreground/90">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={isSignedIn ? "/painel" : "/auth/sign-up"}
                    className="tim-glow-button group relative z-10 mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/35 hover:-translate-y-0.5"
                  >
                    {isSignedIn ? "Ir para o painel" : "Experimentar 14 dias grátis"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground/70">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="h-3 w-3" /> Sem cartão necessário
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> Pagamento seguro via Stripe
                    </span>
                  </div>
                </div>
              </div>

              <FadeIn delay={200} direction="none">
                <p className="mt-5 text-center text-sm text-muted-foreground">
                  Empresa com necessidades específicas?{" "}
                  <a href="mailto:info@xtim.ai" className="font-semibold text-primary hover:underline">
                    Fale connosco
                  </a>
                </p>
              </FadeIn>
            </div>
          </FadeIn>

          {/* FAQ accordion */}
          <FadeIn delay={150}>
            <div>
              <h3 className="text-lg font-bold text-foreground sm:text-xl">Perguntas frequentes</h3>
              <div className="mt-6 space-y-2">
                {FAQS.map((faq, i) => (
                  <AccordionItem key={i} faq={faq} isOpen={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} />
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
