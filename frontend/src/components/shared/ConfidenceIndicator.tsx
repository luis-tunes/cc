import { cn } from "@/lib/utils";

interface ConfidenceIndicatorProps {
  value: number; // 0–100
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function ConfidenceIndicator({
  value,
  showLabel = true,
  size = "sm",
  className,
}: ConfidenceIndicatorProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  const getColor = () => {
    if (clampedValue >= 80) return "bg-tim-success";
    if (clampedValue >= 50) return "bg-tim-warning";
    return "bg-tim-danger";
  };

  const getTextColor = () => {
    if (clampedValue >= 80) return "text-tim-success";
    if (clampedValue >= 50) return "text-tim-warning";
    return "text-tim-danger";
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-full bg-muted",
          size === "sm" ? "h-1.5 w-12" : "h-2 w-20"
        )}
      >
        <div
          className={cn("h-full rounded-full transition-all", getColor())}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showLabel && (
        <span
          className={cn(
            "font-mono font-medium",
            size === "sm" ? "text-xs" : "text-sm",
            getTextColor()
          )}
        >
          {clampedValue}%
        </span>
      )}
    </div>
  );
}
