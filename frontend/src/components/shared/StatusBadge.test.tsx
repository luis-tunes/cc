import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders pendente label", () => {
    render(<StatusBadge status="pendente" />);
    expect(screen.getByText("Pendente")).toBeInTheDocument();
  });

  it("renders reconciliado label", () => {
    render(<StatusBadge status="reconciliado" />);
    expect(screen.getByText("Reconciliado")).toBeInTheDocument();
  });

  it("renders classificado label", () => {
    render(<StatusBadge status="classificado" />);
    expect(screen.getByText("Classificado")).toBeInTheDocument();
  });

  it("renders rejeitado label", () => {
    render(<StatusBadge status="rejeitado" />);
    expect(screen.getByText("Rejeitado")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <StatusBadge status="pendente" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("all statuses render without error", () => {
    const statuses = [
      "pendente", "importado", "extraído", "classificado",
      "reconciliado", "revisto", "arquivado", "atrasado",
      "anomalia", "rejeitado",
    ] as const;
    for (const status of statuses) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(/.+/)).toBeInTheDocument();
      unmount();
    }
  });
});
