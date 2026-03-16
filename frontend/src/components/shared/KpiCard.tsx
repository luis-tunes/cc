import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

interface KpiCardProps {
  label: string;
  value: string;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  icon?: LucideIcon;
  accent?: boolean;
  variant?: "default" | "warning" | "danger";
  compact?: boolean;
  className?: string;
  sparkline?: number[];
}

export function KpiCard({
  label,
  value,
  trend,
  icon: Icon,
  accent = false,
  variant = "default",
  compact = false,
  className,
  sparkline,
}: KpiCardProps) {
  const borderClass = {
    default: accent ? "border-primary/30 shadow-[0_0_15px_-3px_hsl(var(--tim-gold)/0.12)]" : "",
    warning: "border-tim-warning/30",
    danger: "border-tim-danger/30",
  };

  const sparkColor =
    variant === "warning" ? "hsl(38,92%,50%)" :
    variant === "danger"  ? "hsl(0,65%,50%)" :
    accent                ? "hsl(40,80%,55%)" :
                            "hsl(220,10%,55%)";

  const sparkData = sparkline?.map((v) => ({ v }));

  return (
    <div
      className={cn(
        "rounded-lg border bg-card",
        compact ? "px-3 py-2.5" : "p-4",
        borderClass[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p
          className={cn(
            "font-medium uppercase tracking-wider text-muted-foreground",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {label}
        </p>
        {Icon && (
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              variant === "warning" && "text-tim-warning",
              variant === "danger" && "text-tim-danger",
              variant === "default" && "text-muted-foreground"
            )}
          />
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p
            className={cn(
              "font-semibold tracking-tight",
              compact ? "mt-0.5 text-2xl" : "mt-1 text-3xl",
              accent ? "text-primary" : "text-foreground",
              variant === "danger" && "text-tim-danger",
              variant === "warning" && "text-tim-warning"
            )}
          >
            {value}
          </p>
          {trend && (
            <div className="mt-1.5 flex items-center gap-1">
              {trend.direction === "up" && (
                <TrendingUp className="h-3 w-3 text-tim-success" />
              )}
              {trend.direction === "down" && (
                <TrendingDown className="h-3 w-3 text-tim-danger" />
              )}
              {trend.direction === "neutral" && (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span
                className={cn(
                  "text-xs",
                  trend.direction === "up" && "text-tim-success",
                  trend.direction === "down" && "text-tim-danger",
                  trend.direction === "neutral" && "text-muted-foreground"
                )}
              >
                {trend.value}
              </span>
            </div>
          )}
        </div>
        {sparkData && sparkData.length > 1 && (
          <div className="h-10 w-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`sg-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor}
                  strokeWidth={1.5}
                  fill={`url(#sg-${label})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
