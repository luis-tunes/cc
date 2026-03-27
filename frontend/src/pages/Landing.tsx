import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import {
  FileText,
  ArrowRight,
  Shield,
  Zap,
  BarChart3,
  Receipt,
  Bot,
  Check,
  ChevronRight,
  Play,
  Building2,
  Clock,
  TrendingUp,
  Eye,
  Menu,
  X,
  Upload,
  Mail,
  Lock,
  CreditCard,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background antialiased scroll-smooth">
      <Nav />
      <Hero />
      <Logos />
      <Features />
      <HowItWorks />
      <Stats />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}

/* ── Navigation ─────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#precos", label: "Preços" },
];

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isSignedIn } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const ctaTo = isSignedIn ? "/painel" : "/auth/sign-up";
  const ctaLabel = isSignedIn ? "Ir para o painel" : "Experimentar grátis";

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b bg-card/90 backdrop-blur-xl shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight text-primary">xtim.ai</span>
          <span className="hidden text-xs font-medium uppercase tracking-widest text-muted-foreground sm:inline">
            Contabilidade Inteligente
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative text-sm text-muted-foreground transition-colors hover:text-foreground after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:bg-primary after:transition-all hover:after:w-full"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {!isSignedIn && (
            <Link
              to="/auth/sign-in"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Entrar
            </Link>
          )}
          <Link
            to={ctaTo}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 sm:px-4 sm:py-2.5"
          >
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      <div
        className={`fixed inset-0 top-[53px] z-40 bg-background/95 backdrop-blur-sm transition-all duration-300 md:hidden ${
          open ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        }`}
      >
        <div className="flex flex-col gap-1 px-4 pt-4">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted"
            >
              {l.label}
            </a>
          ))}
          <div className="my-2 h-px bg-border" />
          {!isSignedIn && (
            <Link
              to="/auth/sign-in"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Entrar
            </Link>
          )}
          <Link
            to={ctaTo}
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-base font-bold text-primary-foreground"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────── */

function Hero() {
  const { isSignedIn } = useAuth();
  const ctaTo = isSignedIn ? "/painel" : "/auth/sign-up";
  const ctaLabel = isSignedIn ? "Ir para o painel" : "Experimentar 14 dias grátis";

  return (
    <section className="relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent" />
      <div className="absolute -top-32 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl sm:-top-40 sm:h-[500px] sm:w-[800px]" />
      <div className="absolute -right-20 top-40 hidden h-[300px] w-[300px] rounded-full bg-primary/[0.03] blur-3xl lg:block" />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-20 md:pb-28 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 sm:mb-8 sm:px-4 sm:py-2">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Experimente 14 dias sem compromisso
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
            A contabilidade do seu{" "}
            <span className="relative text-primary">
              negócio
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 5.5C47 2 153 2 199 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
              </svg>
            </span>
            , no piloto automático
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:mt-6 sm:text-base md:text-lg">
            Digitalize faturas, reconcilie movimentos bancários e tenha sempre
            a visão financeira da sua empresa — tudo automatizado, em português.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:mt-10 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              to={ctaTo}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/35 hover:-translate-y-0.5 sm:w-auto sm:py-4"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#como-funciona"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-6 py-3.5 text-sm font-semibold text-foreground transition-all hover:bg-muted/50 sm:w-auto sm:py-4"
            >
              <Play className="h-4 w-4 text-primary" />
              Ver como funciona
            </a>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground/60">
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Sem cartão de crédito</span>
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Cancele quando quiser</span>
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Suporte em português</span>
          </div>
        </div>

        {/* App preview */}
        <div className="mx-auto mt-12 max-w-4xl sm:mt-16">
          <div className="relative rounded-xl border bg-card p-1.5 shadow-2xl shadow-black/[0.08] sm:rounded-2xl sm:p-2">
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 rounded-t-lg bg-muted/50 px-3 py-2 sm:gap-2 sm:px-4 sm:py-2.5">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/20 sm:h-2.5 sm:w-2.5" />
              <div className="h-2 w-2 rounded-full bg-muted-foreground/20 sm:h-2.5 sm:w-2.5" />
              <div className="h-2 w-2 rounded-full bg-muted-foreground/20 sm:h-2.5 sm:w-2.5" />
              <div className="ml-2 flex-1 rounded-md bg-background/80 px-3 py-1">
                <span className="text-xs text-muted-foreground/40">app.tim.pt/painel</span>
              </div>
            </div>
            <div className="rounded-b-lg bg-muted/30 p-4 sm:p-6 md:p-8 lg:p-12">
              {/* KPI row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <PreviewKpi label="Faturação" value="€42.580" trend="+12%" icon={TrendingUp} />
                <PreviewKpi label="Documentos" value="284" trend="Este mês" icon={FileText} />
                <PreviewKpi label="Reconciliação" value="96%" trend="Automática" icon={Check} />
              </div>
              {/* Pipeline flow */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 md:grid-cols-4">
                {[
                  { icon: Upload, label: "Fatura digitalizada", status: "Extraído", color: "text-tim-info" },
                  { icon: Bot, label: "Classificação IA", status: "Conta 62", color: "text-primary" },
                  { icon: Receipt, label: "Movimento bancário", status: "Associado", color: "text-tim-warning" },
                  { icon: Check, label: "Reconciliação", status: "Confirmado", color: "text-tim-success" },
                ].map((item, i) => (
                  <div key={item.label} className="group relative rounded-lg border bg-card p-3 transition-all hover:shadow-md sm:p-4">
                    {i < 3 && (
                      <div className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 md:block">
                        <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                      </div>
                    )}
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <p className="mt-2 text-xs font-medium text-foreground">{item.label}</p>
                    <p className={`mt-0.5 text-xs font-medium ${item.color}`}>{item.status}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewKpi({
  label,
  value,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3 sm:p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-9 sm:w-9">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-lg font-bold text-foreground sm:text-xl md:text-2xl">{value}</p>
        <p className="text-xs font-medium text-tim-success">{trend}</p>
      </div>
    </div>
  );
}

/* ── Social proof ────────────────────────────────────────────────────── */

const SECTORS = ["Restauração", "Comércio", "Serviços", "Hotelaria", "Construção", "Saúde"];

function Logos() {
  return (
    <section className="border-y bg-muted/20 py-8 sm:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Pensado para negócios portugueses
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:mt-6 sm:gap-x-10">
          {SECTORS.map((sector, i) => (
            <div key={sector} className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground/40">
                {sector}
              </span>
              {i < SECTORS.length - 1 && (
                <span className="hidden text-muted-foreground/15 sm:inline">|</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features ────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Eye,
    title: "OCR inteligente",
    description:
      "Digitalize faturas, recibos e notas de crédito. Extração automática de NIF, valores, IVA e datas com reconhecimento ótico avançado.",
    highlight: "< 30 segundos",
  },
  {
    icon: Bot,
    title: "Classificação por IA",
    description:
      "O xtim.ai aprende com o seu histórico e sugere contas SNC automaticamente. Aprovação com um clique.",
    highlight: "Aprende consigo",
  },
  {
    icon: Receipt,
    title: "Reconciliação automática",
    description:
      "Associação inteligente entre documentos e movimentos bancários por valor e data. Taxa de correspondência média de 95%.",
    highlight: "95% automático",
  },
  {
    icon: BarChart3,
    title: "Dashboard financeiro",
    description:
      "Visão completa do estado financeiro do seu negócio: faturação, despesas, IVA a entregar e fluxo de caixa.",
    highlight: "Tempo real",
  },
  {
    icon: TrendingUp,
    title: "Relatórios e insights",
    description:
      "Demonstração de resultados, análise de fornecedores e tendências — pronto para o seu contabilista.",
    highlight: "Pronto a exportar",
  },
  {
    icon: Shield,
    title: "Seguro e conforme",
    description:
      "Dados encriptados, em conformidade com RGPD. Interface 100% em português, pensada para quem não é contabilista.",
    highlight: "RGPD",
  },
];

function Features() {
  return (
    <section id="funcionalidades" className="py-16 sm:py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Funcionalidades</p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Tudo o que precisa, nada que não precise
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Ferramentas profissionais, desenhadas para serem simples.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="rounded-full border border-primary/15 bg-primary/[0.04] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary/80">
                  {f.highlight}
                </span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How it works ────────────────────────────────────────────────────── */

const STEPS = [
  {
    number: "01",
    title: "Carregue os seus documentos",
    description: "Arraste faturas, recibos ou notas de crédito — PDF, foto ou scan. O OCR faz o resto.",
  },
  {
    number: "02",
    title: "Revisão inteligente",
    description: "O xtim.ai extrai valores, NIF e IVA automaticamente. A IA sugere a classificação contabilística.",
  },
  {
    number: "03",
    title: "Importe os movimentos bancários",
    description: "Carregue o extrato CSV do seu banco. Os movimentos são associados aos documentos automaticamente.",
  },
  {
    number: "04",
    title: "Painel de controlo em tempo real",
    description: "Veja a saúde financeira da sua empresa num dashboard claro — pronto para o contabilista.",
  },
];

function HowItWorks() {
  return (
    <section id="como-funciona" className="border-y bg-muted/20 py-16 sm:py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Como funciona</p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Do papel ao digital em 4 passos
          </h2>
        </div>

        {/* Desktop: horizontal grid */}
        <div className="mt-10 sm:mt-14">
          <div className="hidden lg:grid lg:grid-cols-4 lg:gap-0">
            {STEPS.map((step, i) => (
              <div key={step.number} className="relative px-4">
                {i < STEPS.length - 1 && (
                  <div className="absolute right-0 top-7 h-px w-full bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" style={{ left: "calc(56px + 1rem)" }} />
                )}
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-lg shadow-primary/20">
                  {step.number}
                </div>
                <h3 className="mt-5 text-base font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>

          {/* Mobile/Tablet: vertical timeline */}
          <div className="flex flex-col gap-0 lg:hidden">
            {STEPS.map((step, i) => (
              <div key={step.number} className="relative flex gap-4 pb-8 sm:gap-6">
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[23px] top-14 bottom-0 w-px bg-gradient-to-b from-primary/20 to-transparent sm:left-[27px]" />
                )}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 sm:h-14 sm:w-14 sm:rounded-2xl sm:text-lg">
                  {step.number}
                </div>
                <div className="pt-1">
                  <h3 className="text-sm font-semibold text-foreground sm:text-base">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Stats ────────────────────────────────────────────────────────────── */

const STATS = [
  { value: "95%", label: "Taxa de reconciliação", icon: Receipt },
  { value: "<30s", label: "Tempo de extração", icon: Zap },
  { value: "100%", label: "Em português", icon: Shield },
  { value: "14", label: "Dias grátis para testar", icon: Clock },
];

function Stats() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4 md:gap-8">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="group relative overflow-hidden rounded-xl border bg-card p-5 text-center transition-all hover:border-primary/30 hover:shadow-lg sm:p-6"
            >
              <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-primary/[0.04] transition-transform group-hover:scale-150" />
              <stat.icon className="mx-auto h-5 w-5 text-primary/60 sm:h-6 sm:w-6" />
              <p className="mt-3 text-2xl font-bold text-foreground sm:text-3xl md:text-4xl">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ─────────────────────────────────────────────────────────── */

function Pricing() {
  const { isSignedIn } = useAuth();

  return (
    <section id="precos" className="border-y bg-muted/20 py-16 sm:py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Preços</p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Comece grátis, pague só quando quiser continuar
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Crie a sua conta, carregue os seus documentos e extratos bancários.
            Durante 14 dias tem acesso total — sem limites, sem cartão de crédito.
          </p>
        </div>

        {/* How trial works */}
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-6">
          {[
            {
              step: "1",
              title: "Crie a sua conta",
              desc: "Registe-se em 30 segundos. Sem cartão, sem papelada.",
              icon: ArrowRight,
            },
            {
              step: "2",
              title: "Use durante 14 dias",
              desc: "Acesso total a todas as funcionalidades. Carregue documentos e extratos à vontade.",
              icon: Zap,
            },
            {
              step: "3",
              title: "Decida se quer continuar",
              desc: "Subscreva o plano Profissional para manter tudo. Se não quiser, não paga nada.",
              icon: Check,
            },
          ].map((item) => (
            <div key={item.step} className="rounded-xl border bg-card p-5 sm:p-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                {item.step}
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Pricing card */}
        <div className="mx-auto mt-10 max-w-md sm:mt-12">
          <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-card p-6 shadow-lg shadow-primary/5 sm:p-8">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/[0.04]" />

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Profissional</h3>
              <span className="rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold text-primary">
                Após os 14 dias
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground sm:text-4xl">€150</span>
              <span className="text-sm text-muted-foreground">/mês + IVA</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Equivalente a ~€5/dia — menos do que um café e pastel de nata</p>

            <div className="mt-5 h-px bg-border sm:mt-6" />

            <ul className="mt-5 space-y-3 sm:mt-6">
              {[
                "Documentos e OCR ilimitados",
                "Reconciliação automática",
                "Classificação por IA",
                "Dashboard e relatórios",
                "Multi-utilizador",
                "Suporte por email em português",
                "Exportação para contabilista",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-tim-success/10">
                    <Check className="h-3 w-3 text-tim-success" />
                  </div>
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>

            <Link
              to={isSignedIn ? "/painel" : "/auth/sign-up"}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 hover:-translate-y-0.5 sm:mt-8"
            >
              {isSignedIn ? "Ir para o painel" : "Criar conta — é grátis"}
              <ArrowRight className="h-4 w-4" />
            </Link>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground/60">
              <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Sem cartão nos 14 dias</span>
              <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Pagamento seguro via Stripe</span>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-md text-center sm:mt-8">
          <p className="text-sm text-muted-foreground">
            Empresa com necessidades específicas?{" "}
            <a href="mailto:info@tim.pt" className="font-medium text-primary hover:underline">
              Fale connosco
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ────────────────────────────────────────────────────── */

const TESTIMONIALS = [
  {
    quote: "Passei de 2 horas por semana a organizar papéis para 15 minutos. O xtim.ai mudou a forma como vejo a contabilidade.",
    author: "Ricardo M.",
    role: "Dono de restaurante, Lisboa",
  },
  {
    quote: "Finalmente uma ferramenta em português que não precisa de um contabilista para usar. Recomendo a todos os empresários.",
    author: "Ana S.",
    role: "Gestora de loja, Porto",
  },
  {
    quote: "A reconciliação automática é impressionante. Upload do extrato e está feito — quase tudo bate certo sem tocar em nada.",
    author: "Miguel T.",
    role: "Freelancer, Braga",
  },
];

function Testimonials() {
  return (
    <section className="py-16 sm:py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            O que dizem os nossos utilizadores
          </h2>
        </div>

        {/* Mobile: horizontal scroll, Desktop: grid */}
        <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 sm:mt-12 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.author}
              className="min-w-[280px] max-w-[320px] shrink-0 snap-center rounded-xl border bg-card p-5 sm:p-6 md:min-w-0 md:max-w-none"
            >
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <svg key={s} className="h-4 w-4 fill-primary text-primary" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground/80 italic">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3 border-t pt-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {t.author[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.author}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────────── */

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
    q: "O que acontece passados os 14 dias?",
    a: "Se quiser continuar, subscreve o plano Profissional a €150/mês + IVA. Se não quiser, não paga nada — os dados ficam disponíveis para exportação durante 30 dias.",
  },
  {
    q: "Funciona com o meu banco?",
    a: "O xtim.ai aceita extratos bancários em formato CSV, suportado pela maioria dos bancos portugueses. Basta exportar e carregar.",
  },
  {
    q: "Preciso de inserir cartão de crédito?",
    a: "Não. Durante os 14 dias de teste não é necessário qualquer pagamento. Só insere dados de pagamento quando decidir subscrever.",
  },
];

function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="border-t py-16 sm:py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">FAQ</p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Perguntas frequentes
          </h2>
        </div>

        <div className="mt-10 divide-y">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left sm:py-5"
              >
                <span className="text-sm font-semibold text-foreground sm:text-base">{faq.q}</span>
                <ChevronRight
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    openIdx === i ? "rotate-90" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openIdx === i ? "max-h-40 pb-4" : "max-h-0"
                }`}
              >
                <p className="text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ───────────────────────────────────────────────────────── */

function CTA() {
  const { isSignedIn } = useAuth();

  return (
    <section className="relative overflow-hidden border-t py-16 sm:py-20 md:py-28">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent" />
      <div className="absolute -left-20 bottom-0 h-[300px] w-[300px] rounded-full bg-primary/[0.04] blur-3xl" />
      <div className="absolute -right-20 top-0 h-[300px] w-[300px] rounded-full bg-primary/[0.04] blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 sm:h-16 sm:w-16">
          <Building2 className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
        </div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
          Pronto para simplificar a sua contabilidade?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground sm:text-base">
          Carregue os seus documentos e extratos. Veja o xtim.ai a trabalhar. Decida depois.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
          <Link
            to={isSignedIn ? "/painel" : "/auth/sign-up"}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/35 hover:-translate-y-0.5 sm:w-auto sm:py-4"
          >
            {isSignedIn ? "Ir para o painel" : "Criar conta grátis"}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="mailto:info@tim.pt"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Falar com a equipa
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────── */

function Footer() {
  const { isSignedIn } = useAuth();

  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-primary">xtim.ai</span>
              <span className="text-xs text-muted-foreground">Contabilidade Inteligente</span>
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Contabilidade automatizada para negócios portugueses. Simples, seguro e 100% em português.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Produto</h4>
            <ul className="mt-3 space-y-2">
              <li><a href="#funcionalidades" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Funcionalidades</a></li>
              <li><a href="#como-funciona" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Como funciona</a></li>
              <li><a href="#precos" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Preços</a></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Conta</h4>
            <ul className="mt-3 space-y-2">
              {isSignedIn ? (
                <li><Link to="/painel" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Painel</Link></li>
              ) : (
                <>
                  <li><Link to="/auth/sign-in" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Entrar</Link></li>
                  <li><Link to="/auth/sign-up" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Criar conta</Link></li>
                </>
              )}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Contacto</h4>
            <ul className="mt-3 space-y-2">
              <li>
                <a href="mailto:info@tim.pt" className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                  <Mail className="h-3 w-3" />
                  info@tim.pt
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t pt-6 sm:mt-10 sm:pt-8">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-muted-foreground/50">
              © {new Date().getFullYear()} xtim.ai — Contabilidade Inteligente. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-xs text-muted-foreground/40">
                <Shield className="h-3 w-3" />
                RGPD
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground/40">
                <Lock className="h-3 w-3" />
                Encriptado
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
