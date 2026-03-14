import { useQuery } from "@tanstack/react-query";
import {
  fetchIvaPeriods,
  fetchIrcEstimate,
  fetchAuditFlags,
  fetchObligations,
  fetchPlReport,
  fetchTopSuppliers,
  type IvaPeriod,
  type IrcEstimate,
  type AuditFlagsResult,
  type Obligation,
  type PlReport,
  type TopSupplier,
} from "@/lib/api";

export function useIvaPeriods() {
  return useQuery<IvaPeriod[]>({
    queryKey: ["tax", "iva-periods"],
    queryFn: fetchIvaPeriods,
  });
}

export function useIrcEstimate() {
  return useQuery<IrcEstimate>({
    queryKey: ["tax", "irc-estimate"],
    queryFn: fetchIrcEstimate,
  });
}

export function useAuditFlags() {
  return useQuery<AuditFlagsResult>({
    queryKey: ["tax", "audit-flags"],
    queryFn: fetchAuditFlags,
  });
}

export function useObligations(year?: number) {
  return useQuery<Obligation[]>({
    queryKey: ["obligations", year],
    queryFn: () => fetchObligations(year),
  });
}

export function usePlReport(year?: number) {
  return useQuery<PlReport>({
    queryKey: ["reports", "pl", year],
    queryFn: () => fetchPlReport(year),
  });
}

export function useTopSuppliers(limit = 10) {
  return useQuery<TopSupplier[]>({
    queryKey: ["reports", "top-suppliers", limit],
    queryFn: () => fetchTopSuppliers(limit),
  });
}
