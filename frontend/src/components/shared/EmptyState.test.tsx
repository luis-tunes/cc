import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "./EmptyState";
import { FileText } from "lucide-react";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="Sem documentos" />);
    expect(screen.getByText("Sem documentos")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="Vazio" description="Nenhum resultado encontrado" />);
    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
  });

  it("does not render description when omitted", () => {
    const { container } = render(<EmptyState title="Vazio" />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(0);
  });

  it("renders tutorial text when provided", () => {
    render(<EmptyState title="T" tutorial="Carregue em Upload para começar" />);
    expect(screen.getByText("Carregue em Upload para começar")).toBeInTheDocument();
  });

  it("renders action button and fires callback", async () => {
    const onClick = vi.fn();
    render(<EmptyState title="T" actionLabel="Adicionar" onAction={onClick} />);
    const btn = screen.getByRole("button", { name: "Adicionar" });
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not render button when actionLabel is missing", () => {
    render(<EmptyState title="T" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders custom icon", () => {
    const { container } = render(<EmptyState title="T" icon={FileText} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<EmptyState title="T" className="my-class" />);
    expect(container.firstChild).toHaveClass("my-class");
  });

  it("renders default icon when none provided", () => {
    const { container } = render(<EmptyState title="T" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
