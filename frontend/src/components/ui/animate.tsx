import { cn } from "@/lib/utils";
import type { ReactNode, CSSProperties } from "react";

interface FadeInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
}

const directionMap = {
  up: "translate-y-2",
  down: "-translate-y-2",
  left: "translate-x-2",
  right: "-translate-x-2",
  none: "",
} as const;

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 400,
  direction = "up",
}: FadeInProps) {
  const style: CSSProperties = {
    animationDelay: `${delay}ms`,
    animationDuration: `${duration}ms`,
    animationFillMode: "both",
  };

  return (
    <div
      className={cn(
        "animate-in fade-in",
        directionMap[direction],
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

interface StaggerChildrenProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  duration?: number;
}

export function StaggerChildren({
  children,
  className,
  stagger = 50,
  direction = "up",
  duration = 400,
}: StaggerChildrenProps) {
  const items = Array.isArray(children) ? children : [children];

  return (
    <div className={className}>
      {items.map((child, i) =>
        child ? (
          <FadeIn key={i} delay={i * stagger} direction={direction} duration={duration}>
            {child}
          </FadeIn>
        ) : null,
      )}
    </div>
  );
}
