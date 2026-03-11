import { cn } from "@/lib/utils";

interface TimelineMarkerProps {
  timestamp: string;
  label: string;
  detail?: string;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

export function TimelineMarker({
  timestamp,
  label,
  detail,
  variant = "default",
  className,
}: TimelineMarkerProps) {
  const dotColor = {
    default: "bg-muted-foreground",
    success: "bg-tim-success",
    warning: "bg-tim-warning",
    danger: "bg-tim-danger",
  };

  return (
    <div className={cn("flex gap-3", className)}>
      <div className="flex flex-col items-center">
        <div className={cn("mt-1.5 h-2 w-2 rounded-full", dotColor[variant])} />
        <div className="w-px flex-1 bg-border" />
      </div>
      <div className="pb-4">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {detail && (
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground/70">{timestamp}</p>
      </div>
    </div>
  );
}
