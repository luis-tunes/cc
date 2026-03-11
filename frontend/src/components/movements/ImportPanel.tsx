import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  Landmark,
  Link2,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ImportPanelProps {
  onImport: (file: File) => void;
  importing: boolean;
  importProgress: number;
  importResult?: { success: number; failed: number } | null;
  className?: string;
}

export function ImportPanel({
  onImport,
  importing,
  importProgress,
  importResult,
  className,
}: ImportPanelProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onImport(file);
    },
    [onImport]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onImport(file);
      e.target.value = "";
    },
    [onImport]
  );

  return (
    <div className={cn("grid gap-3 lg:grid-cols-4", className)}>
      {/* CSV Upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors lg:col-span-2",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-card/50 hover:border-muted-foreground/30"
        )}
      >
        {importing ? (
          <div className="w-full space-y-2 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            <p className="text-xs font-medium text-foreground">A importar movimentos…</p>
            <Progress value={importProgress} className="h-1.5" />
          </div>
        ) : importResult ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-tim-success" />
            <p className="mt-1 text-xs font-medium text-foreground">
              {importResult.success} movimentos importados
            </p>
            {importResult.failed > 0 && (
              <p className="text-[10px] text-tim-danger">
                {importResult.failed} linhas com erro
              </p>
            )}
          </div>
        ) : (
          <>
            <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">
              Importar extrato CSV
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Formato: Data, Descrição, Referência, Montante, Saldo
            </p>
            <label>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <span>Selecionar CSV</span>
              </Button>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </label>
          </>
        )}
      </div>

      {/* Future bank sync cards */}
      <SyncCard
        icon={Landmark}
        title="Sync Bancário"
        description="Ligação direta ao banco"
        status="Em breve"
      />
      <SyncCard
        icon={CreditCard}
        title="Open Banking"
        description="PSD2 / API bancária"
        status="Em breve"
      />
    </div>
  );
}

function SyncCard({
  icon: Icon,
  title,
  description,
  status,
}: {
  icon: any;
  title: string;
  description: string;
  status: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-card/50 px-4 py-6 opacity-50">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <p className="mt-2 text-xs font-medium text-foreground">{title}</p>
      <p className="text-[10px] text-muted-foreground">{description}</p>
      <span className="mt-2 rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {status}
      </span>
    </div>
  );
}
