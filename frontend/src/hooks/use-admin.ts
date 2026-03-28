import { useQuery } from "@tanstack/react-query";
import {
  fetchAdminTenants,
  fetchSystemHealth,
  fetchAdminMetrics,
  type AdminTenant,
  type SystemHealth,
  type AdminMetrics,
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
