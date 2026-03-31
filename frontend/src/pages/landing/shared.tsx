import { useState, useEffect, useRef, useCallback } from "react";

/* ── Shared IntersectionObserver pool ──────────────────────────────── */

type InViewCallback = (entry: IntersectionObserverEntry) => void;

const observerMap = new Map<string, { observer: IntersectionObserver; callbacks: Map<Element, InViewCallback> }>();

function getPooledObserver(threshold: number, rootMargin: string): IntersectionObserver {
  const key = `${threshold}|${rootMargin}`;
  const existing = observerMap.get(key);
  if (existing) return existing.observer;

  const callbacks = new Map<Element, InViewCallback>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const cb = callbacks.get(entry.target);
        if (cb) cb(entry);
      }
    },
    { threshold, rootMargin },
  );
  observerMap.set(key, { observer, callbacks });
  return observer;
}

function observe(el: Element, threshold: number, rootMargin: string, cb: InViewCallback): () => void {
  const key = `${threshold}|${rootMargin}`;
  const pool = observerMap.get(key);
  if (!pool) return () => {};
  pool.callbacks.set(el, cb);
  pool.observer.observe(el);
  return () => {
    pool.callbacks.delete(el);
    pool.observer.unobserve(el);
  };
}

/* ── useInView ─────────────────────────────────────────────────────── */

export function useInView(options?: { threshold?: number; rootMargin?: string; once?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const { threshold = 0.15, rootMargin = "0px 0px -60px 0px", once = true } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    // Use pooled observer
    getPooledObserver(threshold, rootMargin);
    return observe(el, threshold, rootMargin, (entry) => {
      if (entry.isIntersecting) {
        setVisible(true);
        if (once) {
          const key = `${threshold}|${rootMargin}`;
          const pool = observerMap.get(key);
          if (pool) {
            pool.callbacks.delete(el);
            pool.observer.unobserve(el);
          }
        }
      }
    });
  }, [threshold, rootMargin, once]);

  return { ref, visible };
}

/* ── FadeIn ────────────────────────────────────────────────────────── */

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  duration?: number;
}

export function FadeIn({ children, className = "", delay = 0, direction = "up", duration = 700 }: FadeInProps) {
  const { ref, visible } = useInView();

  const transforms: Record<string, string> = {
    up: "translate-y-12",
    down: "-translate-y-12",
    left: "translate-x-12",
    right: "-translate-x-12",
    none: "",
  };

  return (
    <div
      ref={ref}
      className={`${visible ? "opacity-100 translate-y-0 translate-x-0" : `opacity-0 ${transforms[direction]}`} ${className}`}
      style={{
        transitionProperty: "opacity, transform",
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {children}
    </div>
  );
}

/* ── CountUp ───────────────────────────────────────────────────────── */

export function CountUp({ value, suffix = "" }: { value: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const triggered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const num = parseInt(value.replace(/[^0-9]/g, ""), 10);
    if (isNaN(num)) return;

    const prefix = value.match(/^[^0-9]*/)?.[0] ?? "";
    const postfix = value.match(/[^0-9]*$/)?.[0] ?? "";

    const duration = 800;

    getPooledObserver(0.5, "0px");
    return observe(el, 0.5, "0px", (entry) => {
      if (!entry.isIntersecting || triggered.current) return;
      triggered.current = true;

      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(num * eased);
        setDisplay(`${prefix}${current}${postfix}`);
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, [value]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}
