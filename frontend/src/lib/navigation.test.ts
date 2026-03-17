import { describe, it, expect } from "vitest";
import { navigation } from "./navigation";

describe("navigation config", () => {
  it("has 3 groups", () => {
    expect(navigation).toHaveLength(3);
    expect(navigation.map((g) => g.label)).toEqual(["Principal", "Negócio", "Definições"]);
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

  it("Principal group contains core pages", () => {
    const paths = navigation[0].items.map((i) => i.path);
    expect(paths).toContain("/painel");
    expect(paths).toContain("/documentos");
    expect(paths).toContain("/movimentos");
    expect(paths).toContain("/reconciliacao");
  });

  it("Negócio group contains business pages", () => {
    const paths = navigation[1].items.map((i) => i.path);
    expect(paths).toContain("/inventario");
    expect(paths).toContain("/fornecedores");
    expect(paths).toContain("/produtos");
    expect(paths).toContain("/centro-fiscal");
    expect(paths).toContain("/relatorios");
  });

  it("Definições group contains settings pages", () => {
    const paths = navigation[2].items.map((i) => i.path);
    expect(paths).toContain("/entidade");
    expect(paths).toContain("/definicoes");
    expect(paths).toContain("/guia");
  });

  it("total nav items count is reasonable", () => {
    const total = navigation.reduce((sum, g) => sum + g.items.length, 0);
    expect(total).toBeGreaterThanOrEqual(15);
    expect(total).toBeLessThanOrEqual(30);
  });
});
