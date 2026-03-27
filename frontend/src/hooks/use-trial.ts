import { useBillingStatus } from "@/hooks/use-billing";

/** @deprecated Use useIsFreePlan instead */
export function useIsTrial() {
  return useIsFreePlan();
}

/** Returns true when the user is on the free plan (not pro/custom). */
export function useIsFreePlan() {
  const { data: billing } = useBillingStatus();
  if (!billing) return false;
  return billing.plan !== "pro" && billing.plan !== "custom";
}
