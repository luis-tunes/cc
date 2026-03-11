import { cn } from "@/lib/utils";
import { ForecastScenario } from "@/lib/forecast-data";

interface ScenarioToggleProps {
  scenarios: ForecastScenario[];
  active: string;
  onChange: (id: string) => void;
}

export function ScenarioToggle({ scenarios, active, onChange }: ScenarioToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50 p-0.5">
      {scenarios.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
            active === s.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={s.description}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
