import { Receipt, Zap, Shield, Clock } from "lucide-react";
import { FadeIn, CountUp } from "./shared";

const STATS_DATA = [
  { value: "95", suffix: "%", label: "Taxa de reconciliação", icon: Receipt, hero: true },
  { value: "30", suffix: "s", prefix: "<", label: "Tempo de extração", icon: Zap, hero: false },
  { value: "100", suffix: "%", label: "Em português", icon: Shield, hero: false },
  { value: "0", suffix: "€", label: "Para começar a usar", icon: Clock, hero: false },
];

export function Stats() {
  return (
    <section className="relative py-20 sm:py-24 md:py-28 overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.02] to-background" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <FadeIn>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-10 sm:mb-14">
            Números que falam por si
          </p>
        </FadeIn>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4 md:gap-8">
          {STATS_DATA.map((stat, i) => (
            <FadeIn key={stat.label} delay={i * 100}>
              <div
                className={`group relative overflow-hidden rounded-2xl border p-6 text-center transition-all tim-card-hover sm:p-7 ${
                  stat.hero
                    ? "border-primary/30 bg-gradient-to-br from-primary/[0.06] to-card shadow-lg shadow-primary/5"
                    : "bg-card"
                }`}
              >
                {/* Decorative circle */}
                <div
                  className={`absolute -right-4 -top-4 h-24 w-24 rounded-full transition-transform duration-700 group-hover:scale-[2] ${
                    stat.hero ? "bg-primary/[0.08]" : "bg-primary/[0.04]"
                  }`}
                />

                <div className="relative">
                  <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl ${
                    stat.hero ? "bg-primary/15" : "bg-muted"
                  } sm:h-11 sm:w-11`}>
                    <stat.icon className={`h-5 w-5 ${stat.hero ? "text-primary" : "text-primary/60"} sm:h-5 sm:w-5`} />
                  </div>
                  <p className={`mt-4 font-bold text-foreground tabular-nums ${
                    stat.hero ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl md:text-4xl"
                  }`}>
                    {stat.value === "0" ? (
                      <>0{stat.suffix}</>
                    ) : (
                      <>
                        {stat.prefix ?? ""}
                        <CountUp value={stat.value} suffix={stat.suffix} />
                      </>
                    )}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
