import { describe, it, expect, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePageTitle } from "./use-page-title";

describe("usePageTitle", () => {
  afterEach(() => {
    document.title = "";
  });

  it("sets document title with suffix", () => {
    renderHook(() => usePageTitle("Painel"));
    expect(document.title).toBe("Painel · xtim.ai");
  });

  it("sets default title when no title provided", () => {
    renderHook(() => usePageTitle());
    expect(document.title).toBe("xtim.ai — Contabilidade Inteligente");
  });

  it("sets default title when title is empty string", () => {
    renderHook(() => usePageTitle(""));
    expect(document.title).toBe("xtim.ai — Contabilidade Inteligente");
  });

  it("restores default title on unmount", () => {
    const { unmount } = renderHook(() => usePageTitle("Documentos"));
    expect(document.title).toBe("Documentos · xtim.ai");
    unmount();
    expect(document.title).toBe("xtim.ai — Contabilidade Inteligente");
  });

  it("updates title when title prop changes", () => {
    const { rerender } = renderHook(
      ({ title }) => usePageTitle(title),
      { initialProps: { title: "Painel" } },
    );
    expect(document.title).toBe("Painel · xtim.ai");
    rerender({ title: "Documentos" });
    expect(document.title).toBe("Documentos · xtim.ai");
  });
});
