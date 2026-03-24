import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  ArrowRight,
  Shield,
  Zap,
  Sparkles,
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
  MapPin,
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
          <span className="text-2xl font-bold tracking-tight text-primary">TIM</span>
          <span className="hidden text-xs font-medium uppercase tracking-widest text-muted-foreground sm:inline">
            Time is Money
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
          <Link
            to="/auth/sign-in"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Entrar
          </Link>
          <Link
            to="/auth/sign-up"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 sm:px-4 sm:py-2.5"
          >
            Começar grátis
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
          <Link
            to="/auth/sign-in"
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Entrar
          </Link>
          <Link
            to="/auth/sign-up"
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-base font-bold text-primary-foreground"
          >
            Começar grátis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent" />
      <div className="absolute -top-32 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl sm:-top-40 sm:h-[500px] sm:w-[800px]" />
      <div className="absolute -right-20 top-40 hidden h-[300px] w-[300px] rounded-full bg-primary/[0.03] blur-3xl lg:block" />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-20 md:pb-28 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 sm:mb-8 sm:px-4 sm:py-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              14 dias grátis · Sem cartão
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
              to="/auth/sign-up"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/35 hover:-translate-y-0.5 sm:w-auto sm:py-4"
            >
              Começar gratuitamente
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
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Sem compromisso</span>
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Cancele quando quiser</span>
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Suporte em português</span>
          </div>
        </div>

        {/* App preview */}
        <div className="mx-auto mt-12 max-w-4xl sm:mt-16">
          <div className="relative rounded-xl border bg-card p-1.5 shadow-2xl shadow-black/[0.08] sm:rounded-2xl sm:p-2">
            {/* Fake browser bar */}
            <div className="flex items-center gap-1.5 rounded-t-lg bg-muted/50 px-3 py-2 sm:gap-2 sm:px-4 sm:py-2.5">
              <div className="h-2 w-2 rounded-full bg-red-400/60 sm:h-2.5 sm:w-2.5" />
              <div className="h-2 w-2 rounded-full bg-yellow-400/60 sm:h-2.5 sm:w-2.5" />
              <div className="h-2 w-2 rounded-full bg-green-400/60 sm:h-2.5 sm:w-2.5" />
              <div className="ml-2 flex-1 rounded-md bg-background/80 px-3 py-1">
                <span className="text-[10px] text-muted-foreground/40 sm:text-xs">app.tim.pt</span>
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

const SECTORS = [
  { name: "Restauração", icon: "🍽️" },
  { name: "Comércio", icon: "🛒" },
  { name: "Serviços", icon: "💼" },
  { name: "Hotelaria", icon: "🏨" },
  { name: "Construção", icon: "🏗️" },
  { name: "Saúde", icon: "🏥" },
];

function Logos() {
  return (
    <section className="border-y bg-muted/20 py-8 sm:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Pensado para negócios portugueses
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3 sm:mt-6 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-10 sm:gap-y-3">
          {SECTORS.map((sector) => (
            <div key={sector.name} className="flex items-center justify-center gap-1.5 rounded-lg py-2 sm:py-0">
              <span className="text-base">{sector.icon}</span>
              <span className="text-xs font-semibold text-muted-foreground/50 sm:text-sm">
                {sector.name}
              </span>
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
    highlight: "Extração em <30s",
  },
  {
    icon: Bot,
    title: "Classificação por IA",
    description:
      "O TIM aprende com o seu histórico e sugere contas SNC automaticamente. Aprovação com um clique.",
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
    highlight: "Exportação fácil",
  },
  {
    icon: Shield,
    title: "Seguro e português",
    description:
      "Dados encriptados, RGPD compliant. Interface 100% em português, pensada para quem não é contabilista.",
    highlight: "RGPD compliant",
  },
];

function Features() {
  return (
    <section id="funcionalidades" className="py-16 sm:py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/[0.06] px-4 py-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Funcionalidades</span>
          </div>
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
                <span className="rounded-full bg-primary/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary sm:text-xs">
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
    icon: Upload,
  },
  {
    number: "02",
    title: "Revisão inteligente",
    description: "O TIM extrai valores, NIF e IVA automaticamente. A IA sugere a classificação contabilística.",
    icon: Bot,
  },
  {
    number: "03",
    title: "Importe os movimentos bancários",
    description: "Carregue o extrato CSV do seu banco. Os movimentos são associados aos documentos automaticamente.",
    icon: Receipt,
  },
  {
    number: "04",
    title: "Painel de controlo em tempo real",
    description: "Veja a saúde financeira da sua empresa num dashboard claro — pronto para o contabilista.",
    icon: BarChart3,
  },
];

function HowItWorks() {
  return (
    <section id="como-funciona" className="border-y bg-muted/20 py-16 sm:py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/[0.06] px-4 py-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Como funciona</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Do papel ao digital em 4 passos
          </h2>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="mt-10 sm:mt-14">
          {/* Desktop: horizontal grid */}
          <div className="hidden lg:grid lg:grid-cols-4 lg:gap-0">
            {STEPS.map((step, i) => (
              <div key={step.number} className="relative px-4">
                {/* Connector line */}
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
                {/* Vertical line */}
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
  { value: "100%", label: "Em português", icon: MapPin },
  { value: "0€", label: "Para começar", icon: Sparkles },
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

/* ── Pricing preview ─────────────────────────────────────────────────── */

function Pricing() {
  return (
    <section id="precos" className="border-y bg-muted/20 py-16 sm:py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Simples e transparente
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Um plano. Tudo incluído. 14 dias grátis para experimentar.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-md sm:mt-12">
          <div className="relative overflow-hidden rounded-2xl border border-primary/50 bg-card p-6 shadow-lg shadow-primary/5 sm:p-8">
            {/* Decorative corner gradient */}
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/[0.06]" />

            <div className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-md sm:left-6">
              14 dias grátis
            </div>

            <h3 className="mt-2 text-lg font-bold text-foreground">Profissional</h3>
            <div className="mt-3 flex items-baseline gap-1 sm:mt-4">
              <span className="text-3xl font-bold text-foreground sm:text-4xl">€150</span>
              <span className="text-sm text-muted-foreground">/mês + IVA</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">~€5/dia para automatizar a sua contabilidade</p>

            <div className="mt-5 h-px bg-border sm:mt-6" />

            <ul className="mt-5 space-y-3 sm:mt-6">
              {[
                "Documentos e OCR ilimitados",
                "Reconciliação automática",
                "Classificação por IA",
                "Dashboard financeiro",
                "Relatórios e exportação",
                "Multi-utilizador",
                "Suporte por email em português",
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
              to="/auth/sign-up"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 hover:-translate-y-0.5 sm:mt-8"
            >
              Começar teste gratuito
              <ArrowRight className="h-4 w-4" />
            </Link>

            <p className="mt-3 text-center text-xs text-muted-foreground/60 sm:mt-4">
              Sem cartão de crédito · Cancele a qualquer momento
            </p>
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-md text-center sm:mt-8">
          <p className="text-sm text-muted-foreground">
            Empresa com necessidades especiais?{" "}
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
    quote: "Passei de 2 horas por semana a organizar papéis para 15 minutos. O TIM mudou a forma como vejo a contabilidade.",
    author: "Ricardo M.",
    role: "Dono de restaurante, Lisboa",
    metric: "2h → 15min",
  },
  {
    quote: "Finalmente uma ferramenta em português que não precisa de um contabilista para usar. Recomendo a todos os empresários.",
    author: "Ana S.",
    role: "Gestora de loja, Porto",
    metric: "100% português",
  },
  {
    quote: "A reconciliação automática é magia. Upload do extrato e está feito — quase tudo bate certo sem tocar em nada.",
    author: "Miguel T.",
    role: "Freelancer, Braga",
    metric: "95% automático",
  },
];

function Testimonials() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section className="py-16 sm:py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            O que dizem os nossos clientes
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Empresários como você que já simplificaram a sua gestão financeira.
          </p>
        </div>

        {/* Mobile: horizontal scroll, Desktop: grid */}
        <div
          ref={scrollRef}
          className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 sm:mt-12 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0"
        >
          {TESTIMONIALS.map((t) => (
            <div
              key={t.author}
              className="min-w-[280px] max-w-[320px] shrink-0 snap-center rounded-xl border bg-card p-5 sm:p-6 md:min-w-0 md:max-w-none"
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg key={s} className="h-4 w-4 fill-primary text-primary" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="rounded-full bg-tim-success/10 px-2 py-0.5 text-[10px] font-bold text-tim-success sm:text-xs">
                  {t.metric}
                </span>
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

        {/* Scroll indicator dots — mobile only */}
        <div className="mt-4 flex items-center justify-center gap-1.5 md:hidden">
          {TESTIMONIALS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === 0 ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/20"}`} />
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
    a: "Não. O TIM foi desenhado para empresários, não para contabilistas. A interface explica tudo em linguagem simples.",
  },
  {
    q: "Os meus dados estão seguros?",
    a: "Sim. Utilizamos encriptação em trânsito e em repouso, e cumprimos o RGPD. Os seus dados nunca são partilhados com terceiros.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim. Sem fidelização, sem taxas de cancelamento. Os seus dados permanecem disponíveis para exportação durante 30 dias após o cancelamento.",
  },
  {
    q: "Funciona com o meu banco?",
    a: "O TIM aceita extratos bancários em formato CSV, suportado pela maioria dos bancos portugueses. Basta exportar e carregar.",
  },
];

function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="border-t py-16 sm:py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Perguntas frequentes
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Tudo o que precisa de saber antes de começar.
          </p>
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
  return (
    <section className="relative overflow-hidden border-t py-16 sm:py-20 md:py-28">
      {/* Background decorations */}
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
          Junte-se a centenas de empresários portugueses que já automatizaram a gestão financeira do seu negócio.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
          <Link
            to="/auth/sign-up"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/35 hover:-translate-y-0.5 sm:w-auto sm:py-4"
          >
            Começar 14 dias grátis
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
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        {/* Top: multi-column on desktop, stacked on mobile */}
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-primary">TIM</span>
              <span className="text-xs text-muted-foreground">Time is Money</span>
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
              <li><Link to="/auth/sign-in" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Entrar</Link></li>
              <li><Link to="/auth/sign-up" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Criar conta</Link></li>
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
              © {new Date().getFullYear()} TIM — Time is Money. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-xs text-muted-foreground/40">
                <Shield className="h-3 w-3" />
                RGPD
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground/40">
                <MapPin className="h-3 w-3" />
                Portugal
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
