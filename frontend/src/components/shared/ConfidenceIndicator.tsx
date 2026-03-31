import { cn } from "@/lib/utils";

interface ConfidenceIndicatorProps {
  value: number; // 0–100
  showLabel?: boolean;
  size?: "sm" | "md";
  variant?: "bar" | "donut";
  className?: string;
}

const strokeColor = (v: number) =>
  v >= 80 ? "hsl(var(--tim-success))" : v >= 50 ? "hsl(var(--tim-warning))" : "hsl(var(--tim-danger))";

const textColor = (v: number) =>
  v >= 80 ? "text-tim-success" : v >= 50 ? "text-tim-warning" : "text-tim-danger";

const bgColor = (v: number) =>
  v >= 80 ? "bg-tim-success" : v >= 50 ? "bg-tim-warning" : "bg-tim-danger";

function DonutRing({ value, diameter }: { value: number; diameter: number }) {
  const stroke = diameter <= 28 ? 3 : 3.5;
  const r = (diameter - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;

  return (
    <svg width={diameter} height={diameter} className="shrink-0 -rotate-90">
      <circle
        cx={diameter / 2}
        cy={diameter / 2}
        r={r}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={stroke}
      />
      <circle
        cx={diameter / 2}
        cy={diameter / 2}
        r={r}
        fill="none"
        stroke={strokeColor(value)}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        className="transition-all duration-500"
      />
    </svg>
  );
}

export function ConfidenceIndicator({
  value,
  showLabel = true,
  size = "sm",
  variant = "bar",
  className,
}: ConfidenceIndicatorProps) {
  const clamped = Math.max(0, Math.min(100, value));

  if (variant === "donut") {
    const d = size === "sm" ? 28 : 40;
    return (
      <div className={cn("relative inline-flex items-center justify-center", className)} role="meter" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={`Confiança: ${clamped}%`}>
        <DonutRing value={clamped} diameter={d} />
        {showLabel && (
          <span
            className={cn(
              "absolute font-mono font-bold tabular-nums",
              textColor(clamped),
              size === "sm" ? "text-[9px]" : "text-xs",
            )}
          >
            {clamped}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)} role="meter" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={`Confiança: ${clamped}%`}>
      <div
        className={cn(
          "overflow-hidden rounded-full bg-muted",
          size === "sm" ? "h-1.5 w-12" : "h-2 w-20"
        )}
      >
        <div
          className={cn("h-full rounded-full transition-all", bgColor(clamped))}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span
          className={cn(
            "font-mono font-medium",
            size === "sm" ? "text-xs" : "text-sm",
            textColor(clamped)
          )}
        >
          {clamped}%
        </span>
      )}
    </div>
  );
}
