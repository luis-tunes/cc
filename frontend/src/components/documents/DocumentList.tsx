import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfidenceIndicator } from "@/components/shared/ConfidenceIndicator";
import {
  FileText,
  Image,
  Mail,
  Upload,
  Plug,
  AlertTriangle,
  Trash2,
  Play,
} from "lucide-react";
import type { DocumentRecord } from "@/lib/documents-data";
import { documentTypeLabels } from "@/lib/documents-data";
import { documentThumbnailUrl } from "@/lib/api";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

interface DocumentListProps {
  documents: DocumentRecord[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onOpenDocument: (doc: DocumentRecord) => void;
  onDelete?: (id: string) => void;
  onProcess?: (id: string) => void;
  className?: string;
}

const sourceIcon = {
  upload: Upload,
  email: Mail,
  api: Plug,
};

export function DocumentList({
  documents,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onOpenDocument,
  onDelete,
  onProcess,
  className,
}: DocumentListProps) {
  const allSelected =
    documents.length > 0 && documents.every((d) => selectedIds.has(d.id));
  const { focusedIndex, containerRef } = useKeyboardNav(documents.length);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <>
      <div className={cn("space-y-2", className)}>
        {documents.map((doc) => {
          const FileIcon = doc.fileType === "pdf" ? FileText : Image;
          return (
            <div
              key={doc.id}
              onClick={() => onOpenDocument(doc)}
              className={cn(
                "flex items-start gap-3 rounded-lg border bg-card p-3 active:bg-accent/50 transition-colors cursor-pointer",
                selectedIds.has(doc.id) && "border-primary/40 bg-accent/30"
              )}
            >
              <Checkbox
                checked={selectedIds.has(doc.id)}
                onCheckedChange={() => onToggleSelect(doc.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 shrink-0"
              />
              <FileIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{doc.fileName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {documentTypeLabels[doc.documentType]} · {doc.supplier || doc.nif || "—"}
                </p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className={cn(
                    "text-sm font-mono font-medium",
                    doc.total && doc.total < 0 ? "text-tim-danger" : "text-foreground"
                  )}>
                    {doc.total != null ? formatCurrency(doc.total) : "—"}
                  </span>
                  <StatusBadge status={doc.classificationStatus} />
                </div>
                {doc.date && (
                  <p className="mt-1 text-xs text-muted-foreground">{doc.date}</p>
                )}
                {doc.classificationStatus === "staging" && (
                  <div className="mt-2 flex gap-2">
                    {onProcess && (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-tim-success hover:bg-tim-success/90"
                        onClick={(e) => { e.stopPropagation(); onProcess(doc.id); }}
                      >
                        <Play className="mr-1 h-3 w-3" /> Processar
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-tim-danger hover:text-tim-danger"
                        onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Remover
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {doc.needsReview && (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tim-warning" aria-label="Aguarda revisão" title="Aguarda revisão" />
              )}
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete?.(doc.id); }}
                  className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Eliminar documento"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      </>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn("rounded-lg border bg-card overflow-x-auto outline-none", className)}
    >
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
              />
            </TableHead>
            <TableHead className="text-sm font-medium text-muted-foreground">
              Documento
            </TableHead>
            <TableHead className="text-sm font-medium text-muted-foreground">
              Entidade
            </TableHead>
            <TableHead className="text-sm font-medium text-muted-foreground text-right">
              Total
            </TableHead>
            <TableHead className="text-sm font-medium text-muted-foreground">
              Data
            </TableHead>
            <TableHead className="text-sm font-medium text-muted-foreground">
              Estado
            </TableHead>
            <TableHead className="text-sm font-medium text-muted-foreground w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc, idx) => {
            const FileIcon = doc.fileType === "pdf" ? FileText : Image;
            const SourceIcon = sourceIcon[doc.source];
            const isLowConf = doc.extractionConfidence < 60;
            const isFocused = focusedIndex === idx;

            return (
              <TableRow
                key={doc.id}
                data-focused={isFocused}
                data-selected={selectedIds.has(doc.id)}
                className={cn(
                  "tim-table-row border-border cursor-pointer",
                  isLowConf && "bg-tim-warning/[0.03]",
                  isFocused && "ring-1 ring-inset ring-primary/40 bg-primary/5"
                )}
                onClick={() => onOpenDocument(doc)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(doc.id)}
                    onCheckedChange={() => onToggleSelect(doc.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <img
                      src={documentThumbnailUrl(Number(doc.id))}
                      alt=""
                      className="h-[34px] w-[24px] shrink-0 rounded border border-border object-cover transition-transform hover:scale-105 cursor-zoom-in"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground max-w-[240px]">
                        {doc.fileName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {documentTypeLabels[doc.documentType]} · {formatDate(doc.uploadedAt)}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground max-w-[180px]">
                      {doc.supplier || doc.customer || "—"}
                    </p>
                    {doc.nif && (
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        {doc.nif}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    "text-sm font-mono font-medium",
                    doc.total && doc.total < 0 ? "text-tim-danger" : "text-foreground"
                  )}>
                    {doc.total != null ? formatCurrency(doc.total) : "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {doc.date || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={doc.classificationStatus} />
                </TableCell>
                <TableCell>
                  {doc.needsReview && (
                    <AlertTriangle className="h-4 w-4 text-tim-warning" aria-label="Aguarda revisão" title="Aguarda revisão" />
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {doc.classificationStatus === "staging" ? (
                    <div className="flex items-center gap-1">
                      {onProcess && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-tim-success hover:bg-tim-success/90"
                          onClick={() => onProcess(doc.id)}
                        >
                          <Play className="mr-1 h-3 w-3" /> Processar
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-tim-danger hover:text-tim-danger"
                          onClick={() => onDelete(doc.id)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" /> Remover
                        </Button>
                      )}
                    </div>
                  ) : onDelete ? (
                    <button
                      onClick={() => onDelete?.(doc.id)}
                      className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Eliminar documento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function formatCurrency(v: number) {
  const abs = Math.abs(v);
  const formatted = abs.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${v < 0 ? "-" : ""}€${formatted}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
