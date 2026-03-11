import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardSummary,
  fetchMonthlyData,
  type DashboardSummary,
  type MonthlyData,
} from "@/lib/api";

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: fetchDashboardSummary,
  });
}

export function useMonthlyData() {
  return useQuery<MonthlyData[]>({
    queryKey: ["dashboard", "monthly"],
    queryFn: fetchMonthlyData,
  });
}
