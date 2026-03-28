import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchBillingPlans,
  fetchBillingStatus,
  createCheckoutSession,
  createBillingPortal,
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
    retry: false,
    staleTime: 60_000,
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

export function useBillingPortal() {
  return useMutation({
    mutationFn: () => createBillingPortal(),
    onSuccess: (data) => {
      window.location.href = data.portal_url;
    },
  });
}
