import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("renders default title and description", () => {
    render(<ErrorState />);
    expect(screen.getByText("Ocorreu um erro")).toBeInTheDocument();
    expect(
      screen.getByText("Não foi possível carregar os dados. Tente novamente.")
    ).toBeInTheDocument();
  });

  it("renders custom title and description", () => {
    render(<ErrorState title="Custom" description="Custom desc" />);
    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.getByText("Custom desc")).toBeInTheDocument();
  });

  it("renders retry button and fires callback", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    const btn = screen.getByRole("button", { name: /tentar novamente/i });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not render retry button when onRetry is omitted", () => {
    render(<ErrorState />);
    expect(
      screen.queryByRole("button", { name: /tentar novamente/i })
    ).not.toBeInTheDocument();
  });

  it("renders network variant", () => {
    render(<ErrorState variant="network" />);
    expect(screen.getByText("Sem ligação à internet")).toBeInTheDocument();
    expect(
      screen.getByText("Verifique a sua ligação e tente novamente.")
    ).toBeInTheDocument();
  });

  it("renders not-found variant", () => {
    render(<ErrorState variant="not-found" />);
    expect(screen.getByText("Não encontrado")).toBeInTheDocument();
  });

  it("renders forbidden variant", () => {
    render(<ErrorState variant="forbidden" />);
    expect(screen.getByText("Sem permissão")).toBeInTheDocument();
  });

  it("renders server variant", () => {
    render(<ErrorState variant="server" />);
    expect(screen.getByText("Erro do servidor")).toBeInTheDocument();
  });

  it("custom title overrides variant title", () => {
    render(<ErrorState variant="network" title="Override" />);
    expect(screen.getByText("Override")).toBeInTheDocument();
    expect(screen.queryByText("Sem ligação à internet")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<ErrorState className="my-custom" />);
    expect(container.firstChild).toHaveClass("my-custom");
  });
});
