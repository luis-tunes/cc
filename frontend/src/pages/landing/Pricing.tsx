import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { ArrowRight, Check, CreditCard, Lock, Zap, Sparkles } from "lucide-react";
import { FadeIn } from "./shared";

export function Pricing() {
  const { isSignedIn } = useAuth();

  return (
    <section id="precos" className="relative border-y bg-muted/30 py-20 sm:py-24 md:py-32 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 tim-dot-grid opacity-20" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Preços</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Comece grátis, pague só quando crescer
            </h2>
            <p className="mt-5 text-base text-muted-foreground sm:text-lg">
              Crie a sua conta e carregue o primeiro documento grátis. Veja o xtim.ai a trabalhar. Decida depois.
            </p>
          </div>
        </FadeIn>

        {/* How trial works */}
        <div className="mx-auto mt-14 grid max-w-3xl gap-4 sm:mt-16 sm:grid-cols-3 sm:gap-5">
          {[
            {
              step: "1",
              title: "Crie a sua conta",
              desc: "Registe-se em 30 segundos. Sem cartão, sem papelada.",
              icon: ArrowRight,
              color: "text-tim-info",
              bg: "bg-tim-info/10",
            },
            {
              step: "2",
              title: "Carregue um documento",
              desc: "Envie uma fatura ou recibo. Veja a IA a extrair dados e classificar automaticamente.",
              icon: Zap,
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              step: "3",
              title: "Desbloqueie tudo",
              desc: "Gostou? Subscreva o plano Pro para documentos ilimitados, reconciliação e muito mais.",
              icon: Sparkles,
              color: "text-tim-success",
              bg: "bg-tim-success/10",
            },
          ].map((item, i) => (
            <FadeIn key={item.step} delay={i * 100}>
              <div className="group h-full rounded-2xl border bg-card p-6 transition-all tim-card-hover">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bg} transition-all group-hover:scale-110`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <h3 className="mt-4 text-sm font-bold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Pricing card — premium treatment */}
        <FadeIn delay={200}>
          <div className="mx-auto mt-14 max-w-md sm:mt-16">
            <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-card p-7 shadow-2xl shadow-primary/10 sm:p-9">
              {/* Background decorative elements — visible */}
              <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/[0.08] blur-xl" />
              <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-tim-success/[0.06] blur-xl" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-extrabold text-foreground">Profissional</h3>
                  <span className="rounded-full border border-primary/30 bg-primary/[0.08] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-primary shadow-sm">
                    Recomendado
                  </span>
                </div>

                <div className="mt-6">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">A partir de</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">&euro;150</span>
                    <span className="text-base text-muted-foreground">/mês + IVA</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Menos de 5&euro;/dia — menos do que um café e pastel de nata
                  </p>
                </div>

                <div className="mt-7 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                <ul className="mt-7 space-y-3.5">
                  {[
                    "Documentos e OCR ilimitados",
                    "Reconciliação automática",
                    "Classificação por IA",
                    "Dashboard e relatórios completos",
                    "Multi-utilizador",
                    "Suporte por email em português",
                    "Exportação para contabilista",
                  ].map((f) => (
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
                  className="tim-glow-button group relative z-10 mt-9 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/35 hover:-translate-y-0.5"
                >
                  {isSignedIn ? "Ir para o painel" : "Começar grátis — 14 dias sem compromisso"}
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
          </div>
        </FadeIn>

        <FadeIn delay={300} direction="none">
          <div className="mx-auto mt-8 max-w-md text-center">
            <p className="text-sm text-muted-foreground">
              Empresa com necessidades específicas?{" "}
              <a href="mailto:info@xtim.ai" className="font-semibold text-primary hover:underline">
                Fale connosco
              </a>
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
