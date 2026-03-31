import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { ArrowRight, ChevronRight, Mail, Shield, Lock, Sparkles, Users } from "lucide-react";
import { FadeIn } from "./shared";

export function Footer() {
  const { isSignedIn } = useAuth();

  return (
    <section className="relative overflow-hidden">
      {/* Grand Finale CTA — ocean depths */}
      <div className="relative py-24 sm:py-28 md:py-36 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" style={{ "--foreground": "210 10% 92%", "--card-foreground": "210 10% 92%", "--muted-foreground": "220 8% 55%", "--border": "220 12% 20%", "--card": "220 14% 11%", "--muted": "220 12% 16%" } as React.CSSProperties}>
        {/* Ocean depth glows */}
        <div className="absolute -left-32 top-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-sky-500/[0.08] blur-[120px]" />
        <div className="absolute -right-32 top-1/4 h-[400px] w-[400px] rounded-full bg-amber-500/[0.06] blur-[100px]" />

        {/* Wave divider at top */}
        <div className="absolute top-0 left-0 right-0 overflow-hidden pointer-events-none -translate-y-[99%]" aria-hidden="true">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" preserveAspectRatio="none">
            <path d="M0 40C360 80 720 0 1080 40C1260 60 1380 50 1440 40V80H0V40Z" fill="rgb(15 23 42)" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
          <FadeIn>
            <span className="text-5xl">⛵</span>
            <h2 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
              A sua contabilidade merece{" "}
              <span className="tim-gradient-text-light">uma nova aventura</span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-base text-slate-400 sm:text-lg">
              Chega de papéis perdidos e horas desperdiçadas. Embarque hoje e veja a diferença.
            </p>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-5">
              <Link
                to={isSignedIn ? "/painel" : "/auth/sign-up"}
                className="tim-glow-button group relative z-10 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-9 py-4 text-base font-black text-primary-foreground shadow-2xl shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-1.5 hover:scale-[1.02] sm:w-auto"
              >
                {isSignedIn ? "Ir para o painel" : "🚀 Criar conta grátis — 14 dias"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="mailto:info@xtim.ai"
                className="flex items-center gap-2 text-sm font-bold text-slate-400 transition-colors hover:text-white"
              >
                Falar com a equipa
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={350} direction="none">
            <div className="mt-10 inline-flex items-center gap-2.5 rounded-2xl border-2 border-slate-700 bg-slate-800/50 px-5 py-2.5">
              <Users className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-slate-400">
                Centenas de empresários portugueses já poupam horas por semana
              </span>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative border-t-2 border-slate-800 bg-slate-900" style={{ "--foreground": "210 10% 92%", "--muted-foreground": "220 8% 55%", "--border": "220 12% 20%" } as React.CSSProperties}>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
            <div className="sm:col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-1">
                <span className="text-lg font-black tracking-tight text-white">xtim</span>
                <span className="text-lg font-black text-primary">.ai</span>
              </Link>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                Contabilidade automatizada para negócios portugueses. Simples, seguro e em português. ⛵
              </p>
            </div>

            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Produto</h4>
              <ul className="mt-4 space-y-2.5">
                {[
                  { label: "Funcionalidades", href: "#funcionalidades" },
                  { label: "Como funciona", href: "#como-funciona" },
                  { label: "Preços", href: "#precos" },
                ].map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-sm text-slate-400 transition-colors hover:text-white">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Conta</h4>
              <ul className="mt-4 space-y-2.5">
                {isSignedIn ? (
                  <li><Link to="/painel" className="text-sm text-slate-400 transition-colors hover:text-white">Painel</Link></li>
                ) : (
                  <>
                    <li><Link to="/auth/sign-in" className="text-sm text-slate-400 transition-colors hover:text-white">Entrar</Link></li>
                    <li><Link to="/auth/sign-up" className="text-sm text-slate-400 transition-colors hover:text-white">Criar conta</Link></li>
                  </>
                )}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Contacto</h4>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <a href="mailto:info@xtim.ai" className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
                    <Mail className="h-3.5 w-3.5" /> info@xtim.ai
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t-2 border-slate-800 pt-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <p className="text-xs text-slate-500">
                &copy; {new Date().getFullYear()} xtim.ai — Contabilidade Inteligente. Todos os direitos reservados.
              </p>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 rounded-xl border-2 border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-400">
                  <Shield className="h-3 w-3 text-emerald-400" /> RGPD
                </span>
                <span className="flex items-center gap-1.5 rounded-xl border-2 border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-slate-400">
                  <Lock className="h-3 w-3 text-sky-400" /> Encriptado
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </section>
  );
}
