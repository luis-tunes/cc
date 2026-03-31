import { Upload, Bot, Building2, BarChart3 } from "lucide-react";
import { FadeIn } from "./shared";

const STEPS = [
  {
    number: "01",
    icon: Upload,
    title: "Carregue os seus documentos",
    description: "Arraste faturas, recibos ou notas de crédito — PDF, foto ou scan. O OCR faz o resto.",
    accent: "from-tim-info to-tim-info/60",
    accentBg: "bg-tim-info",
    iconBg: "bg-tim-info/10",
    iconColor: "text-tim-info",
  },
  {
    number: "02",
    icon: Bot,
    title: "Revisão inteligente",
    description: "O xtim.ai extrai valores, NIF e IVA automaticamente. A IA sugere a classificação contabilística.",
    accent: "from-primary to-primary/60",
    accentBg: "bg-primary",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    number: "03",
    icon: Building2,
    title: "Importe os movimentos bancários",
    description: "Carregue o extrato CSV do seu banco. Os movimentos são associados aos documentos automaticamente.",
    accent: "from-tim-warning to-tim-warning/60",
    accentBg: "bg-tim-warning",
    iconBg: "bg-tim-warning/10",
    iconColor: "text-tim-warning",
  },
  {
    number: "04",
    icon: BarChart3,
    title: "Painel de controlo em tempo real",
    description: "Veja a saúde financeira da sua empresa num dashboard claro — pronto para o contabilista.",
    accent: "from-tim-success to-tim-success/60",
    accentBg: "bg-tim-success",
    iconBg: "bg-tim-success/10",
    iconColor: "text-tim-success",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative border-y bg-muted/30 py-20 sm:py-24 md:py-32 overflow-hidden">
      {/* Background dot grid */}
      <div className="absolute inset-0 tim-dot-grid opacity-30" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Como funciona</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Do papel ao digital em 4 passos
            </h2>
            <p className="mt-5 text-base text-muted-foreground sm:text-lg">
              Automatize a contabilidade da sua empresa em minutos.
            </p>
          </div>
        </FadeIn>

        <div className="mt-14 sm:mt-20">
          {/* Desktop: horizontal grid with connecting line */}
          <div className="hidden lg:block">
            {/* Connecting line */}
            <div className="relative mx-auto" style={{ maxWidth: "calc(100% - 100px)" }}>
              <div className="absolute top-[38px] left-[50px] right-[50px] h-px">
                <div className="h-full w-full bg-gradient-to-r from-tim-info/30 via-primary/30 via-tim-warning/30 to-tim-success/30" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-6">
              {STEPS.map((step, i) => (
                <FadeIn key={step.number} delay={i * 150}>
                  <div className="group relative text-center">
                    {/* Step circle with icon */}
                    <div className="relative mx-auto mb-6">
                      <div className={`mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-2xl border-2 border-border bg-card shadow-lg transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-xl group-hover:-translate-y-1`}>
                        <step.icon className={`h-7 w-7 ${step.iconColor}`} />
                      </div>
                      {/* Number badge */}
                      <div className={`absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full ${step.accentBg} text-xs font-bold text-white shadow-md`}>
                        {step.number}
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-foreground">{step.title}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>

          {/* Mobile/Tablet: vertical timeline with accent line */}
          <div className="flex flex-col gap-0 lg:hidden">
            {STEPS.map((step, i) => (
              <FadeIn key={step.number} delay={i * 100}>
                <div className="relative flex gap-5 pb-10 sm:gap-6">
                  {/* Vertical connector line */}
                  {i < STEPS.length - 1 && (
                    <div className="absolute left-[27px] top-[68px] bottom-0 w-0.5 bg-gradient-to-b from-border to-border/30 sm:left-[31px]" />
                  )}
                  {/* Icon circle */}
                  <div className="relative shrink-0">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-border bg-card shadow-md sm:h-16 sm:w-16 sm:rounded-2xl">
                      <step.icon className={`h-6 w-6 ${step.iconColor} sm:h-7 sm:w-7`} />
                    </div>
                    <div className={`absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full ${step.accentBg} text-[10px] font-bold text-white shadow-sm`}>
                      {step.number}
                    </div>
                  </div>
                  <div className="pt-2">
                    <h3 className="text-sm font-bold text-foreground sm:text-base">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
