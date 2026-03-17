import { describe, it, expect } from "vitest";
import { ALL_ACTIONS, getPageContext, GROUP_LABELS } from "./quick-add-config";

describe("quick-add-config", () => {
  it("ALL_ACTIONS has upload actions", () => {
    const ids = ALL_ACTIONS.map((a) => a.id);
    expect(ids).toContain("upload");
    expect(ids).toContain("fatura");
    expect(ids).toContain("csv");
  });

  it("ALL_ACTIONS has navigation actions", () => {
    const navActions = ALL_ACTIONS.filter((a) => a.navigateTo);
    expect(navActions.length).toBeGreaterThanOrEqual(3);
    expect(navActions.map((a) => a.navigateTo)).toContain("/fornecedores");
    expect(navActions.map((a) => a.navigateTo)).toContain("/inventario");
    expect(navActions.map((a) => a.navigateTo)).toContain("/produtos");
  });

  it("all actions have required fields", () => {
    for (const action of ALL_ACTIONS) {
      expect(action.id).toBeTruthy();
      expect(action.label).toBeTruthy();
      expect(action.icon).toBeDefined();
      expect(["documentos", "financeiro", "negocio"]).toContain(action.group);
    }
  });

  it("no duplicate action ids", () => {
    const ids = ALL_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getPageContext returns default for unknown path", () => {
    const ctx = getPageContext("/unknown-page");
    expect(ctx.recommendedIds).toContain("upload");
    expect(ctx.hint).toBeTruthy();
  });

  it("getPageContext returns specific context for known paths", () => {
    const docs = getPageContext("/documentos");
    expect(docs.recommendedIds).toContain("upload");

    const movimentos = getPageContext("/movimentos");
    expect(movimentos.recommendedIds).toContain("csv");
  });

  it("GROUP_LABELS covers all groups", () => {
    const groups = new Set(ALL_ACTIONS.map((a) => a.group));
    for (const group of groups) {
      expect(GROUP_LABELS[group]).toBeTruthy();
    }
  });
});
