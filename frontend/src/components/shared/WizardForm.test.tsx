import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WizardForm, type WizardStep } from "./WizardForm";

function makeSteps(count: number, overrides?: Partial<WizardStep>[]): WizardStep[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `Step ${i + 1}`,
    description: `Description ${i + 1}`,
    content: <div data-testid={`step-${i + 1}`}>Content {i + 1}</div>,
    ...overrides?.[i],
  }));
}

describe("WizardForm", () => {
  it("renders first step", () => {
    render(<WizardForm steps={makeSteps(3)} onComplete={vi.fn()} />);
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByTestId("step-1")).toBeInTheDocument();
    expect(screen.getByText("1 de 3")).toBeInTheDocument();
  });

  it("navigates to next step", () => {
    render(<WizardForm steps={makeSteps(3)} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /seguinte/i }));
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    expect(screen.getByTestId("step-2")).toBeInTheDocument();
    expect(screen.getByText("2 de 3")).toBeInTheDocument();
  });

  it("navigates back", () => {
    render(<WizardForm steps={makeSteps(3)} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /seguinte/i }));
    fireEvent.click(screen.getByRole("button", { name: /anterior/i }));
    expect(screen.getByText("Step 1")).toBeInTheDocument();
  });

  it("calls onComplete on last step", () => {
    const onComplete = vi.fn();
    render(<WizardForm steps={makeSteps(2)} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: /seguinte/i }));
    fireEvent.click(screen.getByRole("button", { name: /concluir/i }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("shows custom submit label", () => {
    render(<WizardForm steps={makeSteps(1)} onComplete={vi.fn()} submitLabel="Guardar" />);
    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
  });

  it("disables next when step is invalid", () => {
    const steps = makeSteps(2, [{ isValid: () => false }]);
    render(<WizardForm steps={steps} onComplete={vi.fn()} />);
    expect(screen.getByRole("button", { name: /seguinte/i })).toBeDisabled();
  });

  it("shows cancel button on first step", () => {
    const onCancel = vi.fn();
    render(<WizardForm steps={makeSteps(2)} onComplete={vi.fn()} onCancel={onCancel} />);
    const btn = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.click(btn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("renders description when provided", () => {
    render(<WizardForm steps={makeSteps(1)} onComplete={vi.fn()} />);
    expect(screen.getByText("Description 1")).toBeInTheDocument();
  });
});
