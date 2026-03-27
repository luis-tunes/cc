import type { ReactNode } from "react";

interface TrialGateProps {
  children: ReactNode;
}

/**
 * Freemium model — no forced redirect. Free users can always access
 * basic features. Pro-only pages are gated by UpgradeGate instead.
 */
export function TrialGate({ children }: TrialGateProps) {
  return <>{children}</>;
}
