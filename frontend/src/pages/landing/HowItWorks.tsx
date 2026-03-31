import { Upload, Bot, Building2, BarChart3 } from "lucide-react";
import { FadeIn } from "./shared";

const STEPS = [
  {
    number: "01",
    icon: Upload,
    title: "Carregue os seus documentos",
    description: "Arraste faturas, recibos ou notas de crédito — PDF, foto ou scan. O OCR faz o resto.",
    accentBg: "bg-tim-info",
    iconBg: "bg-tim-info/10",
    iconColor: "text-tim-info",
    illustration: (
      <div className="rounded-xl border-2 border-dashed border-tim-info/30 bg-tim-info/5 p-6 text-center">
        <Upload className="mx-auto h-8 w-8 text-tim-info/60" />
        <p className="mt-2 text-xs font-medium text-tim-info/70">Arraste ficheiros aqui</p>
        <div className="mt-3 flex justify-center gap-2">
          <span className="rounded bg-tim-info/10 px-2 py-0.5 text-[10px] font-medium text-tim-info">PDF</span>
          <span className="rounded bg-tim-info/10 px-2 py-0.5 text-[10px] font-medium text-tim-info">JPG</span>
          <span className="rounded bg-tim-info/10 px-2 py-0.5 text-[10px] font-medium text-tim-info">PNG</span>
        </div>
      </div>
    ),
  },
  {
    number: "02",
    icon: Bot,
    title: "Revisão inteligente",
    description: "O xtim.ai extrai valores, NIF e IVA automaticamente. A IA sugere a classificação contabilística.",
    accentBg: "bg-primary",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    illustration: (
      <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">NIF</span>
          <span className="text-xs font-semibold text-foreground">509 123 456</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Total</span>
          <span className="text-xs font-semibold text-foreground">€ 1.250,00</span>
        </div>
        <div className="h-px bg-primary/10" />
        <div className="flex items-center gap-2">
          <Bot className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-bold text-primary">Conta 62 — FSE</span>
        </div>
      </div>
    ),
  },
  {
    number: "03",
    icon: Building2,
    title: "Importe movimentos bancários",
    description: "Carregue o extrato CSV do seu banco. Os movimentos são associados automaticamente.",
    accentBg: "bg-tim-warning",
    iconBg: "bg-tim-warning/10",
    iconColor: "text-tim-warning",
    illustration: (
      <div className="rounded-xl border border-tim-warning/20 bg-tim-warning/5 p-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between rounded-md bg-card px-3 py-1.5 text-[10px]">
            <span className="text-muted-foreground">28/03 — Compra</span>
            <span className="font-semibold text-foreground">-1.250,00 €</span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-card px-3 py-1.5 text-[10px]">
            <span className="text-muted-foreground">27/03 — Receita</span>
            <span className="font-semibold text-tim-success">+3.400,00 €</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: "04",
    icon: BarChart3,
    title: "Painel de controlo em tempo real",
    description: "Veja a saúde financeira da sua empresa num dashboard claro — pronto para o contabilista.",
    accentBg: "bg-tim-success",
    iconBg: "bg-tim-success/10",
    iconColor: "text-tim-success",
    illustration: (
      <div className="rounded-xl border border-tim-success/20 bg-tim-success/5 p-4">
        <div className="flex items-end justify-between gap-1 h-16">
          {[40, 55, 35, 65, 50, 70, 80].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-tim-success/30" style={{ height: `${h}%` }} />
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] font-medium text-tim-success">Faturação mensal</p>
      </div>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative border-y bg-muted/30 py-20 sm:py-24 md:py-32 overflow-hidden">
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

        {/* Cinematic alternating layout */}
        <div className="mt-14 sm:mt-20 space-y-6 lg:space-y-0">
          {STEPS.map((step, i) => {
            const isEven = i % 2 === 0;
            return (
              <FadeIn key={step.number} delay={i * 120}>
                <div className={`relative lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center ${i > 0 ? "lg:mt-4" : ""}`}>
                  {/* Gold thread — vertical line between steps */}
                  {i < STEPS.length - 1 && (
                    <div className="absolute left-7 top-[4.5rem] bottom-0 w-px bg-gradient-to-b from-primary/20 to-primary/5 lg:left-1/2 lg:-translate-x-px lg:top-24" />
                  )}

                  {/* Text side */}
                  <div className={`flex gap-5 lg:gap-6 ${isEven ? "lg:order-1" : "lg:order-2 lg:flex-row-reverse lg:text-right"}`}>
                    {/* Number circle */}
                    <div className="relative shrink-0">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-border bg-card shadow-md`}>
                        <step.icon className={`h-6 w-6 ${step.iconColor}`} />
                      </div>
                      <div className={`absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full ${step.accentBg} text-[10px] font-bold text-white shadow-sm`}>
                        {step.number}
                      </div>
                    </div>
                    <div className="pt-1 lg:pt-3">
                      <h3 className="text-base font-bold text-foreground sm:text-lg">{step.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-md">{step.description}</p>
                    </div>
                  </div>

                  {/* Illustration side — hidden on mobile, shown on lg */}
                  <div className={`hidden lg:block ${isEven ? "lg:order-2" : "lg:order-1"}`}>
                    <div className="mx-auto max-w-[280px]">
                      {step.illustration}
                    </div>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
