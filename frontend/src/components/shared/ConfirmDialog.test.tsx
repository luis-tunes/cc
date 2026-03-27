import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders title and description when open", () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Eliminar item"
        description="Tem a certeza?"
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText("Eliminar item")).toBeInTheDocument();
    expect(screen.getByText("Tem a certeza?")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Eliminar item"
        description="Tem a certeza?"
        onConfirm={vi.fn()}
      />
    );
    expect(screen.queryByText("Eliminar item")).not.toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Eliminar"
        description="Confirme"
        confirmLabel="Sim, eliminar"
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /sim, eliminar/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("renders cancel button", () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Eliminar"
        description="Confirme"
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("uses custom confirm label", () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Eliminar"
        description="Confirme"
        confirmLabel="Apagar tudo"
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /apagar tudo/i })).toBeInTheDocument();
  });

  it("uses default confirm label", () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Eliminar"
        description="Confirme"
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeInTheDocument();
  });
});
