import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchBillingPlans,
  fetchBillingStatus,
  createCheckoutSession,
  type BillingPlan,
  type BillingStatus,
} from "@/lib/api";

export function useBillingPlans() {
  return useQuery<BillingPlan[]>({
    queryKey: ["billing", "plans"],
    queryFn: fetchBillingPlans,
  });
}

export function useBillingStatus() {
  return useQuery<BillingStatus>({
    queryKey: ["billing", "status"],
    queryFn: fetchBillingStatus,
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (planId: string) => createCheckoutSession(planId),
    onSuccess: (data) => {
      window.location.href = data.checkout_url;
    },
  });
}
