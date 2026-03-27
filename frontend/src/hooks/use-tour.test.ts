import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTour } from "./use-tour";

describe("useTour", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("starts at step 0 when tour not completed", () => {
    const { result } = renderHook(() => useTour());
    expect(result.current.step).toBe(0);
    expect(result.current.isActive).toBe(true);
  });

  it("starts inactive when tour was previously completed", () => {
    localStorage.setItem("tim-tour-completed", "1");
    const { result } = renderHook(() => useTour());
    expect(result.current.step).toBe(-1);
    expect(result.current.isActive).toBe(false);
  });

  it("next() increments step", () => {
    const { result } = renderHook(() => useTour());
    act(() => result.current.next());
    expect(result.current.step).toBe(1);
    act(() => result.current.next());
    expect(result.current.step).toBe(2);
  });

  it("skip() deactivates and persists", () => {
    const { result } = renderHook(() => useTour());
    act(() => result.current.skip());
    expect(result.current.step).toBe(-1);
    expect(result.current.isActive).toBe(false);
    expect(localStorage.getItem("tim-tour-completed")).toBe("1");
  });

  it("complete() deactivates and persists", () => {
    const { result } = renderHook(() => useTour());
    act(() => result.current.next());
    act(() => result.current.complete());
    expect(result.current.isActive).toBe(false);
    expect(localStorage.getItem("tim-tour-completed")).toBe("1");
  });

  it("restart() resets to step 0 and clears storage", () => {
    localStorage.setItem("tim-tour-completed", "1");
    const { result } = renderHook(() => useTour());
    expect(result.current.isActive).toBe(false);
    act(() => result.current.restart());
    expect(result.current.step).toBe(0);
    expect(result.current.isActive).toBe(true);
    expect(localStorage.getItem("tim-tour-completed")).toBeNull();
  });
});
