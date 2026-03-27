import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

export interface WizardStep {
  title: string;
  description?: string;
  content: ReactNode;
  /** Return true if step is valid (enables Next). Default: true */
  isValid?: () => boolean;
}

interface WizardFormProps {
  steps: WizardStep[];
  onComplete: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  className?: string;
}

export function WizardForm({
  steps,
  onComplete,
  onCancel,
  submitLabel = "Concluir",
  isSubmitting = false,
  className,
}: WizardFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const canProceed = step.isValid ? step.isValid() : true;

  const goBack = () => setCurrentStep((s) => Math.max(0, s - 1));
  const goNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep((s) => Math.min(steps.length - 1, s + 1));
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Progress bar */}
      {steps.length > 1 && (
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  i < currentStep
                    ? "bg-primary text-primary-foreground"
                    : i === currentStep
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {i < currentStep ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 rounded-full transition-colors",
                    i < currentStep ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Step header */}
      <div>
        <h3 className="text-base font-semibold text-foreground">
          {step.title}
        </h3>
        {step.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {step.description}
          </p>
        )}
      </div>

      {/* Step content */}
      <div className="min-h-[120px]">{step.content}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t pt-4">
        <div>
          {isFirst && onCancel ? (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
          ) : !isFirst ? (
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Anterior
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {currentStep + 1} de {steps.length}
          </span>
          <Button
            size="sm"
            onClick={goNext}
            disabled={!canProceed || isSubmitting}
          >
            {isLast ? (
              submitLabel
            ) : (
              <>
                Seguinte
                <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
