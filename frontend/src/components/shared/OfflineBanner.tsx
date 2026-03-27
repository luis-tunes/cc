import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";

/**
 * Fixed banner shown at the top of the viewport when the browser is offline.
 * Auto-hides when connection is restored.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-transform duration-300",
        isOnline ? "-translate-y-full" : "translate-y-0"
      )}
    >
      <WifiOff className="h-4 w-4" />
      <span>Sem ligação à internet</span>
    </div>
  );
}
