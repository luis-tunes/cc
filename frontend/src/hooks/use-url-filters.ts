import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";

export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const val = searchParams.get(key);
      if (val !== null) (result as Record<string, string>)[key] = val;
    }
    return result;
  }, [searchParams, defaults]);

  const setFilters = useCallback(
    (updates: Partial<T>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value === defaults[key] || value === "" || value === "all") {
            next.delete(key);
          } else {
            next.set(key, value as string);
          }
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams, defaults],
  );

  return [filters, setFilters] as const;
}
