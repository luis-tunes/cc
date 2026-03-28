import { useQuery } from "@tanstack/react-query";
import {
  fetchAdminTenants,
  fetchSystemHealth,
  fetchAdminMetrics,
  fetchRevenue,
  fetchEndpoints,
  fetchErrorLog,
  fetchTenantActivity,
  fetchChurnRisk,
  type AdminTenant,
  type SystemHealth,
  type AdminMetrics,
  type RevenueMetrics,
  type EndpointsResponse,
  type ErrorLogEntry,
  type TenantActivity,
  type ChurnRiskTenant,
} from "@/lib/api";

export function useAdminTenants() {
  return useQuery<AdminTenant[]>({
    queryKey: ["admin", "tenants"],
    queryFn: fetchAdminTenants,
    refetchInterval: 60_000,
  });
}

export function useSystemHealth() {
  return useQuery<SystemHealth>({
    queryKey: ["admin", "system-health"],
    queryFn: fetchSystemHealth,
    refetchInterval: 30_000,
  });
}

export function useAdminMetrics() {
  return useQuery<AdminMetrics>({
    queryKey: ["admin", "metrics"],
    queryFn: fetchAdminMetrics,
    refetchInterval: 60_000,
  });
}

export function useRevenue() {
  return useQuery<RevenueMetrics>({
    queryKey: ["admin", "revenue"],
    queryFn: fetchRevenue,
    refetchInterval: 60_000,
  });
}

export function useEndpoints(window = 300) {
  return useQuery<EndpointsResponse>({
    queryKey: ["admin", "endpoints", window],
    queryFn: () => fetchEndpoints(window),
    refetchInterval: 15_000,
  });
}

export function useErrorLog(limit = 100) {
  return useQuery<ErrorLogEntry[]>({
    queryKey: ["admin", "errors", limit],
    queryFn: () => fetchErrorLog(limit),
    refetchInterval: 15_000,
  });
}

export function useTenantActivity() {
  return useQuery<TenantActivity>({
    queryKey: ["admin", "tenant-activity"],
    queryFn: fetchTenantActivity,
    refetchInterval: 30_000,
  });
}

export function useChurnRisk() {
  return useQuery<ChurnRiskTenant[]>({
    queryKey: ["admin", "churn-risk"],
    queryFn: fetchChurnRisk,
    refetchInterval: 60_000,
  });
}
