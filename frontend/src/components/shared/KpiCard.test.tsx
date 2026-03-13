import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCard } from "./KpiCard";
import { Package } from "lucide-react";

describe("KpiCard", () => {
  it("renders label and value", () => {
    render(<KpiCard label="Documentos" value="42" />);
    expect(screen.getByText("Documentos")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders trend when provided", () => {
    render(
      <KpiCard
        label="Receita"
        value="€1.200"
        trend={{ value: "+12%", direction: "up" }}
      />
    );
    expect(screen.getByText("+12%")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    const { container } = render(
      <KpiCard label="Stock" value="85" icon={Package} />
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <KpiCard label="Test" value="0" className="my-custom" />
    );
    expect(container.firstChild).toHaveClass("my-custom");
  });

  it("renders all variant types without error", () => {
    for (const variant of ["default", "warning", "danger"] as const) {
      const { unmount } = render(
        <KpiCard label="Test" value="1" variant={variant} />
      );
      expect(screen.getByText("Test")).toBeInTheDocument();
      unmount();
    }
  });

  it("renders down and neutral trends", () => {
    const { unmount } = render(
      <KpiCard label="A" value="1" trend={{ value: "-5%", direction: "down" }} />
    );
    expect(screen.getByText("-5%")).toBeInTheDocument();
    unmount();

    render(
      <KpiCard label="B" value="2" trend={{ value: "0%", direction: "neutral" }} />
    );
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
