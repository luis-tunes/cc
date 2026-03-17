import { useBillingStatus } from "@/hooks/use-billing";

/** Returns whether the user is on free trial (no paid plan). */
export function useIsTrial() {
  const { data: billing } = useBillingStatus();
  if (!billing) return false;
  return billing.plan !== "pro" && billing.plan !== "custom";
}
