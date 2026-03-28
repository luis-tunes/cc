import type { ReactNode } from "react";
import { useBillingStatus } from "@/hooks/use-billing";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface TrialGateProps {
  children: ReactNode;
}

/**
 * Freemium model — free users and active trials pass through.
 * Expired trials are redirected to /planos.
 * Pro/Custom always pass.
 */
export function TrialGate({ children }: TrialGateProps) {
  const { data: billing, isLoading } = useBillingStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Paid or no data yet — pass through
  if (!billing || billing.plan === "pro" || billing.plan === "custom") {
    return <>{children}</>;
  }

  // Trial expired — redirect to pricing
  if (billing.status === "trial_expired") {
    return <Navigate to="/planos" replace />;
  }

  // Active trial or free — pass through
  return <>{children}</>;
}
