import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCcw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type ErrorVariant = "generic" | "network" | "not-found" | "forbidden" | "server";

const VARIANT_CONFIG: Record<
  ErrorVariant,
  { title: string; description: string; icon: typeof AlertTriangle }
> = {
  generic: {
    title: "Ocorreu um erro",
    description: "Não foi possível carregar os dados. Tente novamente.",
    icon: AlertTriangle,
  },
  network: {
    title: "Sem ligação à internet",
    description: "Verifique a sua ligação e tente novamente.",
    icon: WifiOff,
  },
  "not-found": {
    title: "Não encontrado",
    description: "O recurso que procura não existe ou foi removido.",
    icon: AlertTriangle,
  },
  forbidden: {
    title: "Sem permissão",
    description: "Não tem acesso a este recurso.",
    icon: AlertTriangle,
  },
  server: {
    title: "Erro do servidor",
    description: "Algo correu mal do nosso lado. Tente novamente mais tarde.",
    icon: AlertTriangle,
  },
};

interface ErrorStateProps {
  title?: string;
  description?: string;
  variant?: ErrorVariant;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title,
  description,
  variant = "generic",
  onRetry,
  className,
}: ErrorStateProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;
  const displayTitle = title ?? config.title;
  const displayDesc = description ?? config.description;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-tim-danger/20 bg-tim-danger/5 px-6 py-12 text-center",
        className
      )}
    >
      <div className="rounded-xl bg-tim-danger/[0.08] p-4">
        <Icon className="h-7 w-7 text-tim-danger" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">
        {displayTitle}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        {displayDesc}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={onRetry}>
          <RefreshCcw className="h-4 w-4" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
