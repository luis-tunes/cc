import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
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
    a: "Sim! Crie uma conta gratuita e carregue o primeiro documento. Veja o xtim.ai a extrair dados automaticamente. Para desbloquear todas as funcionalidades, subscreva o plano Pro.",
  },
  {
    q: "Funciona com o meu banco?",
    a: "O xtim.ai aceita extratos bancários em formato CSV, suportado pela maioria dos bancos portugueses. Basta exportar e carregar.",
  },
  {
    q: "Preciso de inserir cartão de crédito?",
    a: "Não. A conta gratuita não requer qualquer pagamento. Só insere dados de pagamento quando decidir subscrever o plano Pro.",
  },
  {
    q: "Como funciona a reconciliação automática?",
    a: "Carregue o extrato bancário em CSV e o xtim.ai cruza automaticamente cada movimento com as faturas que já tem no sistema. Pode rever e confirmar com um clique.",
  },
  {
    q: "Posso exportar os dados para o meu contabilista?",
    a: "Sim. Pode exportar relatórios, documentos e extratos em qualquer momento. O seu contabilista recebe tudo organizado.",
  },
  {
    q: "Que tipos de documentos são suportados?",
    a: "Faturas, recibos, notas de crédito e outros documentos fiscais em PDF ou imagem. O OCR extrai os campos automaticamente.",
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
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div
      className={`rounded-xl border transition-all duration-300 ${
        isOpen
          ? "border-primary/20 bg-primary/[0.02] shadow-sm"
          : "border-transparent bg-transparent hover:bg-muted/30"
      }`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left tim-touch-target sm:px-6 sm:py-5"
        aria-expanded={isOpen}
      >
        <span className={`text-sm font-semibold transition-colors sm:text-base ${isOpen ? "text-foreground" : "text-foreground/80"}`}>
          {faq.q}
        </span>
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
          isOpen ? "bg-primary/10 rotate-180" : "bg-muted"
        }`}>
          <ChevronDown className={`h-4 w-4 transition-colors ${isOpen ? "text-primary" : "text-muted-foreground"}`} />
        </div>
      </button>
      <div
        style={{ maxHeight: isOpen ? height : 0 }}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
      >
        <div ref={contentRef} className="px-5 pb-5 sm:px-6 sm:pb-6">
          <p className="text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
        </div>
      </div>
    </div>
  );
}

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="py-20 sm:py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <FadeIn>
          <div className="text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">FAQ</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Perguntas frequentes
            </h2>
          </div>
        </FadeIn>

        <FadeIn delay={150}>
          <div className="mt-12 space-y-2">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={i}
                faq={faq}
                isOpen={openIdx === i}
                onToggle={() => setOpenIdx(openIdx === i ? null : i)}
              />
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
