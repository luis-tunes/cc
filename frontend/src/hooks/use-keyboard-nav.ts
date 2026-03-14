import { useEffect, useRef, useState } from "react";

/**
 * Keyboard navigation for list/table rows using j/k keys.
 * Returns the currently focused index and a ref to attach to the container.
 *
 * Usage:
 *   const { focusedIndex, containerRef } = useKeyboardNav(items.length);
 *   <div ref={containerRef} tabIndex={-1}>
 *     {items.map((item, i) => (
 *       <div key={item.id} data-focused={focusedIndex === i} ... />
 *     ))}
 *   </div>
 */
export function useKeyboardNav(count: number) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (count === 0) return;

    const onKey = (e: KeyboardEvent) => {
      // Only activate when the container or a child is focused
      if (!containerRef.current?.contains(document.activeElement) &&
          document.activeElement !== containerRef.current) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, count - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Escape") {
        setFocusedIndex(-1);
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [count]);

  // Reset when count changes (e.g., filter applied)
  useEffect(() => {
    setFocusedIndex(-1);
  }, [count]);

  return { focusedIndex, containerRef, setFocusedIndex };
}
