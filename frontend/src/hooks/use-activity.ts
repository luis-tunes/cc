import { useQuery } from "@tanstack/react-query";
import { fetchActivity, type ActivityEntry } from "@/lib/api";

export function useActivity(limit = 50) {
  return useQuery<ActivityEntry[]>({
    queryKey: ["activity", limit],
    queryFn: () => fetchActivity(limit),
    refetchInterval: 30_000,
  });
}
