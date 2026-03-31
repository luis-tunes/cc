import { Upload, Bot, Building2, BarChart3 } from "lucide-react";
import { FadeIn } from "./shared";

const STEPS = [
  {
    number: "01",
    icon: Upload,
    title: "Carregue os seus documentos",
    description: "Arraste faturas, recibos ou notas de crédito — PDF, foto ou scan. O OCR faz o resto.",
    accentBg: "bg-sky-500",
    iconBg: "bg-sky-100 dark:bg-sky-900/30",
    iconColor: "text-sky-600 dark:text-sky-400",
    emoji: "📜",
    illustration: (
      <div className="rounded-2xl border-2 border-dashed border-sky-300/40 bg-sky-50/50 dark:bg-sky-900/10 p-6 text-center transition-all hover:border-sky-400/60 hover:bg-sky-100/50 dark:hover:bg-sky-900/20">
        <span className="text-3xl">📤</span>
        <p className="mt-2 text-xs font-bold text-sky-600 dark:text-sky-400">Arraste ficheiros aqui</p>
        <div className="mt-3 flex justify-center gap-2">
          <span className="rounded-lg bg-sky-100 dark:bg-sky-900/30 px-2.5 py-1 text-[10px] font-bold text-sky-600 dark:text-sky-400 border border-sky-200/50">PDF</span>
          <span className="rounded-lg bg-sky-100 dark:bg-sky-900/30 px-2.5 py-1 text-[10px] font-bold text-sky-600 dark:text-sky-400 border border-sky-200/50">JPG</span>
          <span className="rounded-lg bg-sky-100 dark:bg-sky-900/30 px-2.5 py-1 text-[10px] font-bold text-sky-600 dark:text-sky-400 border border-sky-200/50">PNG</span>
        </div>
      </div>
    ),
  },
  {
    number: "02",
    icon: Bot,
    title: "Revisão inteligente",
    description: "O xtim.ai extrai valores, NIF e IVA automaticamente. A IA sugere a classificação contabilística.",
    accentBg: "bg-amber-500",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    emoji: "🧭",
    illustration: (
      <div className="space-y-2 rounded-2xl border-2 border-amber-200/40 bg-amber-50/50 dark:bg-amber-900/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-medium">NIF</span>
          <span className="text-xs font-bold text-foreground">509 123 456</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-medium">Total</span>
          <span className="text-xs font-bold text-foreground">€ 1.250,00</span>
        </div>
        <div className="h-0.5 bg-amber-200/50" />
        <div className="flex items-center gap-2">
          <span className="text-sm">🤖</span>
          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">Conta 62 — FSE</span>
        </div>
      </div>
    ),
  },
  {
    number: "03",
    icon: Building2,
    title: "Importe movimentos bancários",
    description: "Carregue o extrato CSV do seu banco. Os movimentos são associados automaticamente.",
    accentBg: "bg-orange-500",
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
    emoji: "⚓",
    illustration: (
      <div className="rounded-2xl border-2 border-orange-200/40 bg-orange-50/50 dark:bg-orange-900/10 p-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-[10px] border border-border/30">
            <span className="text-muted-foreground">28/03 — Compra</span>
            <span className="font-bold text-foreground">-1.250,00 €</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-[10px] border border-border/30">
            <span className="text-muted-foreground">27/03 — Receita</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">+3.400,00 €</span>
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
    accentBg: "bg-emerald-500",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    emoji: "🏝️",
    illustration: (
      <div className="rounded-2xl border-2 border-emerald-200/40 bg-emerald-50/50 dark:bg-emerald-900/10 p-4">
        <div className="flex items-end justify-between gap-1.5 h-16">
          {[40, 55, 35, 65, 50, 70, 80].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-lg bg-emerald-400/40 dark:bg-emerald-500/30 transition-all hover:bg-emerald-500/60" style={{ height: `${h}%` }} />
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400">📊 Faturação mensal</p>
      </div>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative border-y-2 border-border/20 py-20 sm:py-24 md:py-32 overflow-hidden">
      {/* Subtle ocean background */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50/30 via-background to-sky-50/20 dark:from-sky-950/10 dark:via-background dark:to-sky-950/5" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">🗺️ Como funciona</p>
            <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Do papel ao digital em 4 passos
            </h2>
            <p className="mt-5 text-base text-muted-foreground sm:text-lg">
              Automatize a contabilidade da sua empresa em minutos.
            </p>
          </div>
        </FadeIn>

        <div className="mt-14 sm:mt-20 space-y-6 lg:space-y-0">
          {STEPS.map((step, i) => {
            const isEven = i % 2 === 0;
            return (
              <FadeIn key={step.number} delay={i * 120}>
                <div className={`relative lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center ${i > 0 ? "lg:mt-4" : ""}`}>
                  {/* Connecting line between steps */}
                  {i < STEPS.length - 1 && (
                    <div className="absolute left-7 top-[4.5rem] bottom-0 w-0.5 bg-gradient-to-b from-primary/20 to-primary/5 lg:left-1/2 lg:-translate-x-px lg:top-24" />
                  )}

                  {/* Text side */}
                  <div className={`flex gap-5 lg:gap-6 ${isEven ? "lg:order-1" : "lg:order-2 lg:flex-row-reverse lg:text-right"}`}>
                    <div className="relative shrink-0">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-3 border-border/30 bg-card shadow-lg">
                        <span className="text-2xl">{step.emoji}</span>
                      </div>
                      <div className={`absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full ${step.accentBg} text-[10px] font-black text-white shadow-md border-2 border-white dark:border-card`}>
                        {step.number}
                      </div>
                    </div>
                    <div className="pt-1 lg:pt-3">
                      <h3 className="text-base font-black text-foreground sm:text-lg">{step.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-md">{step.description}</p>
                    </div>
                  </div>

                  {/* Illustration side */}
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
