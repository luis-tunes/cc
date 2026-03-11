import { cn } from "@/lib/utils";
import { entityContext } from "@/lib/classifications-data";
import { Building2, Hash, Briefcase, BookOpen } from "lucide-react";

export function EntityContextBar({ className }: { className?: string }) {
  const items = [
    { icon: Building2, label: "Entidade", value: entityContext.name },
    { icon: Hash, label: "NIF", value: entityContext.nif },
    { icon: Briefcase, label: "CAE", value: entityContext.cae },
    { icon: BookOpen, label: "Regime", value: entityContext.regime },
  ];

  return (
    <div className={cn("rounded-lg border bg-card px-4 py-3", className)}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <item.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {item.label}
              </span>
              <span className="text-xs font-medium text-foreground">{item.value}</span>
            </div>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-tim-success animate-pulse" />
          <span className="text-[10px] font-medium text-muted-foreground">{entityContext.profile}</span>
        </div>
      </div>
    </div>
  );
}
