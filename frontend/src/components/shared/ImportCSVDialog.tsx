import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from "lucide-react";
import type { BulkImportResult } from "@/lib/api";

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  templateColumns: string[];
  templateExample: string[][];
  onImport: (file: File) => Promise<BulkImportResult>;
  isPending: boolean;
}

export function ImportCSVDialog({
  open,
  onOpenChange,
  title,
  description,
  templateColumns,
  templateExample,
  onImport,
  isPending,
}: ImportCSVDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setDragOver(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleFileChange = (f: File | null) => {
    if (!f) return;
    const ext = f.name.toLowerCase();
    if (!ext.endsWith(".csv") && !ext.endsWith(".txt")) {
      setError("Formato inválido. Use ficheiro CSV (.csv)");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("Ficheiro demasiado grande (máx 5 MB)");
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const res = await onImport(file);
      setResult(res);
      setFile(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
    }
  };

  const downloadTemplate = () => {
    const header = templateColumns.join(";");
    const rows = templateExample.map((row) => row.join(";"));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>

          {/* Format instructions */}
          <div className="rounded-md border bg-muted/50 p-3 space-y-2">
            <p className="text-xs font-medium">Formato esperado (CSV com separador ; ou ,):</p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b">
                    {templateColumns.map((col) => (
                      <th key={col} className="px-2 py-1 text-left font-mono font-semibold">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {templateExample.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1 font-mono text-muted-foreground">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={downloadTemplate}>
              <Download className="h-3 w-3" />
              Descarregar template
            </Button>
          </div>

          {/* Upload zone */}
          <div
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Arraste um ficheiro CSV ou clique para selecionar
                </p>
              </>
            )}
          </div>

          {/* Error message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success result */}
          {result && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                <p className="font-medium">
                  {result.imported} {result.imported === 1 ? "linha importada" : "linhas importadas"}
                  {result.skipped ? ` · ${result.skipped} duplicados ignorados` : ""}
                </p>
                {result.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer">
                      {result.errors.length} {result.errors.length === 1 ? "aviso" : "avisos"}
                    </summary>
                    <ul className="mt-1 text-xs space-y-0.5 list-disc list-inside text-orange-600 dark:text-orange-400">
                      {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </details>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            {result ? "Fechar" : "Cancelar"}
          </Button>
          {!result && (
            <Button onClick={handleSubmit} disabled={!file || isPending}>
              {isPending ? "A importar…" : "Importar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
