import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileText,
  Image,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { UploadingFile } from "@/lib/documents-data";

interface IntakeZoneProps {
  uploadQueue: UploadingFile[];
  onUpload: (files: File[]) => void;
  onDismiss: (id: string) => void;
  className?: string;
}

export function IntakeZone({ uploadQueue, onUpload, onDismiss, className }: IntakeZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onUpload(files);
    },
    [onUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length) onUpload(files);
      e.target.value = "";
    },
    [onUpload]
  );

  const hasQueue = uploadQueue.length > 0;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
          hasQueue ? "px-4 py-4" : "px-6 py-8",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-card/50 hover:border-muted-foreground/30"
        )}
      >
        <Upload
          className={cn(
            "mb-2 transition-colors",
            hasQueue ? "h-5 w-5" : "h-8 w-8",
            isDragging ? "text-primary" : "text-muted-foreground"
          )}
        />
        <p className="text-sm font-medium text-foreground">
          {isDragging ? "Largar ficheiros aqui" : "Arrastar documentos para importar"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          PDF, JPG, JPEG, PNG, TIFF — máx. 20 MB por ficheiro
        </p>
        <label>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <span>Selecionar ficheiros</span>
          </Button>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
            className="hidden"
            onChange={handleFileInput}
          />
        </label>
      </div>

      {/* Processing queue */}
      {hasQueue && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Fila de Processamento
          </p>
          {uploadQueue.map((file) => (
            <QueueItem key={file.id} file={file} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueItem({
  file,
  onDismiss,
}: {
  file: UploadingFile;
  onDismiss: (id: string) => void;
}) {
  const icon =
    file.name.match(/\.(jpg|jpeg|png|tiff?)$/i) ? Image : FileText;
  const Icon = icon;

  return (
    <div className="flex items-center gap-2.5 rounded-md bg-card px-3 py-2 border">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-medium text-foreground">
            {file.name}
          </p>
          <StatusIndicator status={file.status} />
        </div>
        {(file.status === "uploading" || file.status === "processing") && (
          <Progress
            value={file.progress}
            className="mt-1 h-1"
          />
        )}
        {file.error && (
          <p className="mt-0.5 text-[10px] text-tim-danger">{file.error}</p>
        )}
      </div>
      {(file.status === "extracted" || file.status === "failed") && (
        <button
          onClick={() => onDismiss(file.id)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function StatusIndicator({ status }: { status: UploadingFile["status"] }) {
  switch (status) {
    case "uploading":
      return (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> A carregar…
        </span>
      );
    case "processing":
      return (
        <span className="flex items-center gap-1 text-[10px] text-tim-info">
          <Loader2 className="h-3 w-3 animate-spin" /> A extrair…
        </span>
      );
    case "extracted":
      return (
        <span className="flex items-center gap-1 text-[10px] text-tim-success">
          <CheckCircle2 className="h-3 w-3" /> Extraído
        </span>
      );
    case "failed":
      return (
        <span className="flex items-center gap-1 text-[10px] text-tim-danger">
          <AlertCircle className="h-3 w-3" /> Erro
        </span>
      );
  }
}
