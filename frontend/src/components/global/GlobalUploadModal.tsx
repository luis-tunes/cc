import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ScanSearch,
  Camera,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { uploadDocumentStaging, deleteDocument } from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";
import { ImageLightbox } from "@/components/shared/ImageLightbox";

interface UploadFile {
  id: string;
  file: File;
  status: "queued" | "uploading" | "processing" | "success" | "error";
  progress: number;
  errorMessage?: string;
  result?: any;
  previewUrl?: string;
  source?: "browse" | "camera";
}

interface GlobalUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset?: string;
  onDocumentProcessed?: (doc: any) => void;
}

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.tiff,.tif";

export function GlobalUploadModal({
  open,
  onOpenChange,
  preset,
  onDocumentProcessed,
}: GlobalUploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const processFile = useCallback(
    async (uf: UploadFile) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uf.id ? { ...f, status: "uploading", progress: 30 } : f
        )
      );

      try {
        const formData = new FormData();
        formData.append("file", uf.file);

        setFiles((prev) =>
          prev.map((f) => (f.id === uf.id ? { ...f, progress: 60 } : f))
        );

        // Upload to staging via API client (includes auth token)
        const result = await uploadDocumentStaging(uf.file);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === uf.id
              ? { ...f, status: "success", progress: 100, result }
              : f
          )
        );

        // Show undo toast
        toast("Documento carregado", {
          description: `${uf.file.name} — aguardando confirmação`,
          action: {
            label: "Desfazer",
            onClick: () => {
              if (result?.id) {
                deleteDocument(result.id).catch(() => {});
              }
              setFiles((prev) => prev.filter((f) => f.id !== uf.id));
            },
          },
          duration: 5000,
        });

        onDocumentProcessed?.(result);
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uf.id
              ? {
                  ...f,
                  status: "error",
                  errorMessage: err.message || "Erro ao processar ficheiro",
                }
              : f
          )
        );
      }
    },
    [onDocumentProcessed]
  );

  const addFiles = useCallback(
    (fileList: FileList | File[], source: "browse" | "camera" = "browse") => {
      const newFiles: UploadFile[] = Array.from(fileList).map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        status: "queued" as const,
        progress: 0,
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        source,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
      newFiles.forEach((uf) => processFile(uf));
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleClose = () => {
    // Revoke preview URLs on close
    files.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    onOpenChange(false);
    setTimeout(() => setFiles([]), 300);
  };

  const removeFile = (id: string) => {
    const file = files.find((f) => f.id === id);
    if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const queued = files.filter((f) => f.status === "queued").length;
  const uploading = files.filter((f) => f.status === "uploading").length;
  const processing = files.filter((f) => f.status === "processing").length;
  const succeeded = files.filter((f) => f.status === "success").length;
  const failed = files.filter((f) => f.status === "error").length;
  const allDone =
    files.length > 0 && queued === 0 && uploading === 0 && processing === 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg border-border bg-card p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Upload className="h-4 w-4 text-primary" />
            {preset === "fatura"
              ? "Carregar Fatura"
              : preset === "recibo"
                ? "Carregar Recibo"
                : "Carregar Ficheiros"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5">
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 transition-all",
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-secondary/30"
            )}
          >
            <div
              className={cn(
                "mb-3 flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                isDragOver ? "bg-primary/10" : "bg-secondary"
              )}
            >
              <Upload
                className={cn(
                  "h-5 w-5",
                  isDragOver ? "text-primary" : "text-muted-foreground"
                )}
              />
            </div>
            <p className="text-sm font-medium text-foreground">
              {isDragOver
                ? "Largar ficheiros aqui"
                : "Arrastar ficheiros ou clicar para selecionar"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, JPG, PNG, TIFF · Múltiplos ficheiros suportados
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files, "camera");
              e.target.value = "";
            }}
          />

          {/* Camera capture button (mobile only) */}
          {isMobile && (
            <Button
              variant="outline"
              className="mt-3 h-11 w-full gap-2"
              onClick={(e) => {
                e.stopPropagation();
                cameraRef.current?.click();
              }}
            >
              <Camera className="h-4 w-4" />
              Tirar foto do documento
            </Button>
          )}

          {/* File queue */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {/* Single camera capture: show larger preview */}
              {files.length === 1 && files[0].source === "camera" && files[0].previewUrl && (
                <div className="overflow-hidden rounded-lg bg-muted/30">
                  <img
                    src={files[0].previewUrl}
                    alt={files[0].file.name}
                    className="w-full max-h-48 object-contain"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {files.length} ficheiro{files.length > 1 ? "s" : ""}
                </span>
                {uploading > 0 && (
                  <span className="text-tim-info">A carregar: {uploading}</span>
                )}
                {processing > 0 && (
                  <span className="text-primary">
                    OCR + classificação: {processing}
                  </span>
                )}
                {succeeded > 0 && (
                  <span className="text-tim-success">
                    Concluído: {succeeded}
                  </span>
                )}
                {failed > 0 && (
                  <span className="text-tim-danger">Erro: {failed}</span>
                )}
              </div>

              <div className="max-h-52 space-y-1.5 overflow-y-auto">
                {files.map((uf) => (
                  <FileRow
                    key={uf.id}
                    file={uf}
                    onRemove={() => removeFile(uf.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-3">
          <div className="text-xs text-muted-foreground">
            {allDone &&
              failed === 0 &&
              "Todos os ficheiros processados com sucesso"}
            {allDone &&
              failed > 0 &&
              `${failed} ficheiro${failed > 1 ? "s" : ""} com erro`}
            {!allDone && files.length > 0 && "A processar…"}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleClose}
            >
              {allDone ? "Fechar" : "Cancelar"}
            </Button>
            {allDone && succeeded > 0 && (
              <Button size="sm" className="h-8 text-xs" onClick={handleClose}>
                Ir para Documentos
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FileRow({
  file,
  onRemove,
}: {
  file: UploadFile;
  onRemove: () => void;
}) {
  const ext = file.file.name.split(".").pop()?.toUpperCase() || "";
  const sizeKb = (file.file.size / 1024).toFixed(0);

  return (
    <div className="flex items-center gap-3 rounded-md border border-border/50 bg-secondary/20 px-3 py-2">
      {file.previewUrl ? (
        <img
          src={file.previewUrl}
          alt={file.file.name}
          className="h-10 w-10 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-secondary text-xs font-bold text-muted-foreground">
          {ext}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {file.file.name}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{sizeKb} KB</span>
          {file.status === "uploading" && (
            <Progress value={file.progress} className="h-1 flex-1" />
          )}
          {file.status === "processing" && (
            <span className="flex items-center gap-1 text-xs text-primary">
              <ScanSearch className="h-3 w-3 animate-pulse" />
              OCR + classificação…
            </span>
          )}
          {file.status === "success" && (
            <span className="flex items-center gap-1 text-xs text-tim-success">
              <CheckCircle2 className="h-3 w-3" />
              Processado
            </span>
          )}
          {file.status === "error" && (
            <span className="flex items-center gap-1 text-xs text-tim-danger">
              <AlertCircle className="h-3 w-3" />
              {file.errorMessage}
            </span>
          )}
        </div>
      </div>
      {file.status === "uploading" || file.status === "processing" ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <button
          onClick={onRemove}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
