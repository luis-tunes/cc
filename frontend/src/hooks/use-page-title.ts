import { useEffect } from "react";

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · TIM` : "TIM — Time is Money";
    return () => {
      document.title = "TIM — Time is Money";
    };
  }, [title]);
}
