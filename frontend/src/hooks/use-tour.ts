import { useState, useCallback } from "react";

const TOUR_KEY = "tim-tour-completed";

export function useTour() {
  const [step, setStep] = useState(() => {
    if (typeof window === "undefined") return -1;
    return localStorage.getItem(TOUR_KEY) ? -1 : 0;
  });

  const isActive = step >= 0;

  const next = useCallback(() => setStep((s) => s + 1), []);
  const skip = useCallback(() => {
    setStep(-1);
    localStorage.setItem(TOUR_KEY, "1");
  }, []);
  const complete = useCallback(() => {
    setStep(-1);
    localStorage.setItem(TOUR_KEY, "1");
  }, []);
  const restart = useCallback(() => {
    localStorage.removeItem(TOUR_KEY);
    setStep(0);
  }, []);

  return { step, isActive, next, skip, complete, restart };
}
