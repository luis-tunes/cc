import { Navigate } from "react-router-dom";
import { useBillingStatus } from "@/hooks/use-billing";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

interface TrialGateProps {
  children: ReactNode;
}

/**
 * Wraps the app layout. If the trial has expired and the user hasn't paid,
 * redirects them to the pricing page. During loading or active trial/paid
 * plans, renders children normally.
 */
export function TrialGate({ children }: TrialGateProps) {
  const { data: billing, isLoading } = useBillingStatus();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">A verificar subscrição...</p>
        </div>
      </div>
    );
  }

  // If trial expired and no paid plan, redirect to pricing
  if (billing?.status === "trial_expired") {
    return <Navigate to="/planos" replace />;
  }

  return <>{children}</>;
}
