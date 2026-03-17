import { Navigate } from "react-router-dom";
import { useBillingStatus } from "@/hooks/use-billing";
import { Loader2 } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";

interface TrialGateProps {
  children: ReactNode;
}

/**
 * Wraps the app layout. If the trial has expired and the user hasn't paid,
 * redirects them to the pricing page. During loading or active trial/paid
 * plans, renders children normally.
 */
export function TrialGate({ children }: TrialGateProps) {
  // E2E testing bypass — compile-time constant, tree-shaken in production
  if (import.meta.env.VITE_E2E_TEST) return <>{children}</>;

  const { data: billing, isLoading, isError } = useBillingStatus();
  const [timedOut, setTimedOut] = useState(false);

  // Safety net: if billing check takes more than 4s, let user through
  useEffect(() => {
    if (!isLoading) return;
    const id = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(id);
  }, [isLoading]);

  // If billing check fails or times out, let them through
  if (isError || timedOut) {
    return <>{children}</>;
  }

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
