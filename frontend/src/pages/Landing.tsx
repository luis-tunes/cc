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
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background antialiased">
      <Nav />
      <Hero />
      <Logos />
      <Features />
      <HowItWorks />
      <Stats />
      <Pricing />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
}

/* ── Navigation ─────────────────────────────────────────────────────── */

function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="text-2xl font-bold tracking-tight text-primary">TIM</span>
          <span className="hidden text-xs font-medium uppercase tracking-widest text-muted-foreground sm:inline">
            Time is Money
          </span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a href="#funcionalidades" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Funcionalidades
          </a>
          <a href="#como-funciona" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Como funciona
          </a>
          <a href="#precos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Preços
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/auth/sign-in"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Entrar
          </Link>
          <Link
            to="/auth/sign-up"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-primary/30 transition-all"
          >
            Começar grátis
            <ArrowRight className="h-3.5 w-3.5" />
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
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/[0.06] blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 md:pb-28 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              14 dias grátis · Sem cartão
            </span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            A contabilidade do seu{" "}
            <span className="text-primary">negócio</span>
            , no piloto automático
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Digitalize faturas, reconcilie movimentos bancários e tenha sempre
            a visão financeira da sua empresa — tudo automatizado, em português.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              to="/auth/sign-up"
              className="flex items-center gap-2 rounded-xl bg-primary px-7 py-4 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/35 transition-all"
            >
              Começar gratuitamente
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#como-funciona"
              className="flex items-center gap-2 rounded-xl border border-border px-6 py-4 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
            >
              <Play className="h-4 w-4 text-primary" />
              Ver como funciona
            </a>
          </div>

          <p className="mt-6 text-xs text-muted-foreground/60">
            Sem compromisso · Cancele quando quiser · Suporte em português
          </p>
        </div>

        {/* App preview */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="relative rounded-2xl border bg-card p-2 shadow-2xl shadow-black/5">
            <div className="rounded-xl bg-muted/30 p-8 md:p-12">
              <div className="grid grid-cols-3 gap-4">
                <PreviewKpi label="Faturação" value="€42.580" trend="+12%" />
                <PreviewKpi label="Documentos" value="284" trend="Este mês" />
                <PreviewKpi label="Reconciliação" value="96%" trend="Automática" />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { icon: FileText, label: "Fatura digitalizada", status: "Extraído" },
                  { icon: Bot, label: "Classificação IA", status: "Conta 62" },
                  { icon: Receipt, label: "Movimento bancário", status: "Associado" },
                  { icon: Check, label: "Reconciliação", status: "Confirmado" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border bg-card p-3">
                    <item.icon className="h-4 w-4 text-primary" />
                    <p className="mt-2 text-xs font-medium text-foreground">{item.label}</p>
                    <p className="mt-0.5 text-xs text-tim-success">{item.status}</p>
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

function PreviewKpi({ label, value, trend }: { label: string; value: string; trend: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-tim-success">{trend}</p>
    </div>
  );
}

/* ── Social proof ────────────────────────────────────────────────────── */

function Logos() {
  return (
    <section className="border-y bg-muted/20 py-10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Pensado para negócios portugueses
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {["Restauração", "Comércio", "Serviços", "Hotelaria", "Construção", "Saúde"].map((sector) => (
            <span key={sector} className="text-sm font-semibold text-muted-foreground/40">
              {sector}
            </span>
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
  },
  {
    icon: Bot,
    title: "Classificação por IA",
    description:
      "O TIM aprende com o seu histórico e sugere contas SNC automaticamente. Aprovação com um clique.",
  },
  {
    icon: Receipt,
    title: "Reconciliação automática",
    description:
      "Associação inteligente entre documentos e movimentos bancários por valor e data. Taxa de correspondência média de 95%.",
  },
  {
    icon: BarChart3,
    title: "Dashboard financeiro",
    description:
      "Visão completa do estado financeiro do seu negócio: faturação, despesas, IVA a entregar e fluxo de caixa.",
  },
  {
    icon: TrendingUp,
    title: "Relatórios e insights",
    description:
      "Demonstração de resultados, análise de fornecedores e tendências — pronto para o seu contabilista.",
  },
  {
    icon: Shield,
    title: "Seguro e português",
    description:
      "Dados encriptados, RGPD compliant. Interface 100% em português, pensada para quem não é contabilista.",
  },
];

function Features() {
  return (
    <section id="funcionalidades" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/[0.06] px-4 py-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Funcionalidades</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Tudo o que precisa, nada que não precise
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Ferramentas profissionais, desenhadas para serem simples.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                <f.icon className="h-5 w-5 text-primary" />
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
    description: "O TIM extrai valores, NIF e IVA automaticamente. A IA sugere a classificação contabilística.",
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
    <section id="como-funciona" className="border-y bg-muted/20 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/[0.06] px-4 py-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Como funciona</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Do papel ao digital em 4 passos
          </h2>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div key={step.number} className="relative">
              {i < STEPS.length - 1 && (
                <div className="absolute right-0 top-8 hidden h-px w-8 bg-border lg:block" />
              )}
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
                {step.number}
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Stats ────────────────────────────────────────────────────────────── */

function Stats() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { value: "95%", label: "Taxa de reconciliação" },
            { value: "<30s", label: "Tempo de extração" },
            { value: "100%", label: "Em português" },
            { value: "0€", label: "Para começar" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-foreground md:text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
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
    <section id="precos" className="border-y bg-muted/20 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Simples e transparente
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Um plano. Tudo incluído. 14 dias grátis para experimentar.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-md">
          <div className="relative rounded-2xl border border-primary/50 bg-card p-8 shadow-lg shadow-primary/5">
            <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground">
              14 dias grátis
            </div>

            <h3 className="text-lg font-bold text-foreground">Profissional</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">€150</span>
              <span className="text-sm text-muted-foreground">/mês + IVA</span>
            </div>

            <div className="mt-6 h-px bg-border" />

            <ul className="mt-6 space-y-3">
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
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-tim-success" />
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/auth/sign-up"
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-primary/30 transition-all"
            >
              Começar teste gratuito
              <ArrowRight className="h-4 w-4" />
            </Link>

            <p className="mt-4 text-center text-xs text-muted-foreground/60">
              Sem cartão de crédito · Cancele a qualquer momento
            </p>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-md text-center">
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
  },
  {
    quote: "Finalmente uma ferramenta em português que não precisa de um contabilista para usar. Recomendo a todos os empresários.",
    author: "Ana S.",
    role: "Gestora de loja, Porto",
  },
  {
    quote: "A reconciliação automática é magia. Upload do extrato e está feito — quase tudo bate certo sem tocar em nada.",
    author: "Miguel T.",
    role: "Freelancer, Braga",
  },
];

function Testimonials() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            O que dizem os nossos clientes
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.author} className="rounded-xl border bg-card p-6">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <svg key={s} className="h-4 w-4 fill-primary text-primary" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground/80 italic">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
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

/* ── Final CTA ───────────────────────────────────────────────────────── */

function CTA() {
  return (
    <section className="border-t bg-gradient-to-b from-primary/[0.04] to-transparent py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <Building2 className="mx-auto h-10 w-10 text-primary/60" />
        <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Pronto para simplificar a sua contabilidade?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
          Junte-se a centenas de empresários portugueses que já automatizaram a gestão financeira do seu negócio.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            to="/auth/sign-up"
            className="flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/35 transition-all"
          >
            Começar 14 dias grátis
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="mailto:info@tim.pt"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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
    <footer className="border-t bg-card py-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="text-xl font-bold tracking-tight text-primary">TIM</span>
            <span className="text-xs text-muted-foreground">Time is Money</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="mailto:info@tim.pt" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              info@tim.pt
            </a>
            <Link to="/auth/sign-in" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Entrar
            </Link>
            <Link to="/auth/sign-up" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Criar conta
            </Link>
          </div>
        </div>
        <div className="mt-6 border-t pt-6 text-center">
          <p className="text-xs text-muted-foreground/50">
            © {new Date().getFullYear()} TIM — Time is Money. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
