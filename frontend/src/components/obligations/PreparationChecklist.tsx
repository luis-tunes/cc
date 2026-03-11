import { cn } from "@/lib/utils";
import { preparationChecklist } from "@/lib/obligations-data";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Bell, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PreparationChecklist({ className }: { className?: string }) {
  const [items, setItems] = useState(preparationChecklist);

  const toggle = (index: number) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, done: !item.done } : item)));
  };

  const done = items.filter((i) => i.done).length;
  const total = items.length;

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Checklist de Preparação</h3>
        </div>
        <span className="text-xs text-muted-foreground">{done}/{total}</span>
      </div>

      <div className="p-4 space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-primary/70 mb-2">
          Gerado por IA — ações prioritárias
        </p>

        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 py-1.5">
            <Checkbox
              checked={item.done}
              onCheckedChange={() => toggle(i)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs text-foreground", item.done && "line-through text-muted-foreground")}>
                {item.label}
              </p>
              <span className="text-[9px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                {item.obligation}
              </span>
            </div>
          </div>
        ))}

        <div className="pt-3 border-t mt-3 space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Lembretes
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-[10px] h-8"
              onClick={() => toast.success("Lembrete ativado para obrigações próximas")}
            >
              <Bell className="mr-1.5 h-3 w-3" />
              Lembrete In-App
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-[10px] h-8 opacity-60"
              disabled
            >
              <Mail className="mr-1.5 h-3 w-3" />
              Email (em breve)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
