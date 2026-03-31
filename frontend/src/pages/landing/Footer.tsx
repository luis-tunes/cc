import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { ArrowRight, ChevronRight, Mail, Shield, Lock, Sparkles, Users } from "lucide-react";
import { FadeIn } from "./shared";

export function Footer() {
  const { isSignedIn } = useAuth();

  return (
    <section className="relative overflow-hidden tim-dark-section">
      {/* CTA — Grand Finale */}
      <div className="relative py-24 sm:py-28 md:py-36">
        <div className="absolute -left-32 top-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/[0.08] blur-[120px]" />
        <div className="absolute -right-32 top-1/4 h-[400px] w-[400px] rounded-full bg-tim-info/[0.06] blur-[100px]" />

        <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
          <FadeIn>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 shadow-lg shadow-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mt-8 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              <span className="tim-gradient-text-light">A sua contabilidade merece melhor</span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
              Chega de papéis perdidos e horas desperdiçadas. Comece hoje e veja a diferença.
            </p>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-5">
              <Link
                to={isSignedIn ? "/painel" : "/auth/sign-up"}
                className="tim-glow-button group relative z-10 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-9 py-4 text-base font-bold text-primary-foreground shadow-2xl shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-1 sm:w-auto"
              >
                {isSignedIn ? "Ir para o painel" : "Criar conta grátis — 14 dias"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="mailto:info@xtim.ai"
                className="flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Falar com a equipa
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={350} direction="none">
            <div className="mt-10 inline-flex items-center gap-2.5 rounded-full border border-border/50 bg-muted/10 px-5 py-2.5">
              <Users className="h-4 w-4 text-primary/80" />
              <span className="text-sm text-muted-foreground">
                Centenas de empresários portugueses já poupam horas por semana
              </span>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Footer — continues dark canvas */}
      <footer className="relative border-t border-border/30">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
            <div className="sm:col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-0.5">
                <span className="text-lg font-extrabold tracking-tight text-foreground">xtim</span>
                <span className="text-lg font-extrabold text-primary">.ai</span>
              </Link>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Contabilidade automatizada para negócios portugueses. Simples, seguro e em português.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/60">Produto</h4>
              <ul className="mt-4 space-y-2.5">
                {[
                  { label: "Funcionalidades", href: "#funcionalidades" },
                  { label: "Como funciona", href: "#como-funciona" },
                  { label: "Preços", href: "#precos" },
                ].map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/60">Conta</h4>
              <ul className="mt-4 space-y-2.5">
                {isSignedIn ? (
                  <li><Link to="/painel" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Painel</Link></li>
                ) : (
                  <>
                    <li><Link to="/auth/sign-in" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Entrar</Link></li>
                    <li><Link to="/auth/sign-up" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Criar conta</Link></li>
                  </>
                )}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/60">Contacto</h4>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <a href="mailto:info@xtim.ai" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                    <Mail className="h-3.5 w-3.5" /> info@xtim.ai
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-border/30 pt-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <p className="text-xs text-muted-foreground/70">
                &copy; {new Date().getFullYear()} xtim.ai — Contabilidade Inteligente. Todos os direitos reservados.
              </p>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/10 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <Shield className="h-3 w-3 text-tim-success" /> RGPD
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/10 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <Lock className="h-3 w-3 text-tim-info" /> Encriptado
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </section>
  );
}
