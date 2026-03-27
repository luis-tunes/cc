import { useEffect } from "react";

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · xtim.ai` : "xtim.ai — Contabilidade Inteligente";
    return () => {
      document.title = "xtim.ai — Contabilidade Inteligente";
    };
  }, [title]);
}
