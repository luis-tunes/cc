import { describe, it, expect } from "vitest";
import { navigation } from "./navigation";

describe("navigation config", () => {
  it("has 6 groups", () => {
    expect(navigation).toHaveLength(6);
    expect(navigation.map((g) => g.label)).toEqual([
      "Home", "Documentos", "Financeiro", "Negócio", "Inteligência", "Sistema",
    ]);
  });

  it("all items have required fields", () => {
    for (const group of navigation) {
      for (const item of group.items) {
        expect(item.title).toBeTruthy();
        expect(item.path).toMatch(/^\//);
        expect(item.icon).toBeDefined();
        expect(["active", "coming-soon"]).toContain(item.status);
      }
    }
  });

  it("has no duplicate paths", () => {
    const paths = navigation.flatMap((g) => g.items.map((i) => i.path));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("Home group has dashboard", () => {
    const paths = navigation[0].items.map((i) => i.path);
    expect(paths).toContain("/painel");
  });

  it("Documentos group contains doc-related pages", () => {
    const byLabel = navigation.find((g) => g.label === "Documentos")!;
    const paths = byLabel.items.map((i) => i.path);
    expect(paths).toContain("/caixa-entrada");
    expect(paths).toContain("/documentos");
    expect(paths).toContain("/classificacoes");
  });

  it("Financeiro group contains finance pages", () => {
    const byLabel = navigation.find((g) => g.label === "Financeiro")!;
    const paths = byLabel.items.map((i) => i.path);
    expect(paths).toContain("/movimentos");
    expect(paths).toContain("/reconciliacao");
    expect(paths).toContain("/centro-fiscal");
    expect(paths).toContain("/relatorios");
  });

  it("Negócio group contains business pages", () => {
    const byLabel = navigation.find((g) => g.label === "Negócio")!;
    const paths = byLabel.items.map((i) => i.path);
    expect(paths).toContain("/inventario");
    expect(paths).toContain("/fornecedores");
    expect(paths).toContain("/produtos");
  });

  it("Sistema group contains settings pages", () => {
    const byLabel = navigation.find((g) => g.label === "Sistema")!;
    const paths = byLabel.items.map((i) => i.path);
    expect(paths).toContain("/entidade");
    expect(paths).toContain("/definicoes");
    expect(paths).toContain("/guia");
  });

  it("total nav items count is reasonable", () => {
    const total = navigation.reduce((sum, g) => sum + g.items.length, 0);
    expect(total).toBeGreaterThanOrEqual(15);
    expect(total).toBeLessThanOrEqual(35);
  });
});
