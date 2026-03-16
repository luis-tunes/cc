import { Button } from "@/components/ui/button";
import { Upload, Eye, CheckCircle2, GitMerge, X } from "lucide-react";

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const STEPS: TourStep[] = [
  {
    title: "1. Carregue um documento",
    description:
      "Faça upload de uma fatura, recibo ou nota de crédito. O sistema lê automaticamente os dados com OCR.",
    icon: <Upload className="h-6 w-6 text-primary" />,
  },
  {
    title: "2. Reveja os dados extraídos",
    description:
      "Abra o documento para verificar se o NIF, valor e data foram lidos corretamente. Corrija se necessário.",
    icon: <Eye className="h-6 w-6 text-primary" />,
  },
  {
    title: "3. Aprove o documento",
    description:
      "Se os dados estiverem corretos, aprove. Documentos aprovados ficam prontos para reconciliação.",
    icon: <CheckCircle2 className="h-6 w-6 text-primary" />,
  },
  {
    title: "4. Reconcilie com o banco",
    description:
      "Importe o extrato bancário e o sistema liga automaticamente faturas a pagamentos. Simples.",
    icon: <GitMerge className="h-6 w-6 text-primary" />,
  },
];

interface GuidedTourProps {
  step: number;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function GuidedTour({ step, onNext, onSkip, onComplete }: GuidedTourProps) {
  if (step < 0 || step >= STEPS.length) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative mx-4 w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
        <button
          onClick={onSkip}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Saltar tutorial"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="rounded-xl bg-primary/10 p-4">{current.icon}</div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">{current.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {current.description}
          </p>

          {/* Progress dots */}
          <div className="mt-5 flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="mt-5 flex gap-3">
            <Button variant="ghost" size="sm" onClick={onSkip}>
              Saltar
            </Button>
            <Button size="sm" onClick={isLast ? onComplete : onNext}>
              {isLast ? "Começar a usar" : "Seguinte"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
