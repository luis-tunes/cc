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
} from "lucide-react";
import type { DocumentRecord } from "@/lib/documents-data";
import { documentTypeLabels } from "@/lib/documents-data";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface DocumentListProps {
  documents: DocumentRecord[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onOpenDocument: (doc: DocumentRecord) => void;
  onDelete?: (id: string) => void;
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
  className,
}: DocumentListProps) {
  const allSelected =
    documents.length > 0 && documents.every((d) => selectedIds.has(d.id));
  const { focusedIndex, containerRef } = useKeyboardNav(documents.length);
  const isMobile = useIsMobile();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const confirmDelete = (id: string) => setDeleteTarget(id);
  const handleConfirmDelete = () => {
    if (deleteTarget && onDelete) {
      onDelete(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const deleteConfirmDialog = (
    <ConfirmDialog
      open={deleteTarget !== null}
      onOpenChange={(open) => !open && setDeleteTarget(null)}
      title="Eliminar documento"
      description="Tem a certeza que pretende eliminar este documento? Esta ação não pode ser desfeita."
      confirmLabel="Eliminar"
      onConfirm={handleConfirmDelete}
    />
  );

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
              </div>
              {doc.needsReview && (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tim-warning" />
              )}
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); confirmDelete(doc.id); }}
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
      {deleteConfirmDialog}
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
                className={cn(
                  "border-border cursor-pointer transition-colors",
                  isLowConf && "bg-tim-warning/[0.03]",
                  selectedIds.has(doc.id) && "bg-accent/50",
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
                    <AlertTriangle className="h-4 w-4 text-tim-warning" />
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {onDelete && (
                    <button
                      onClick={() => confirmDelete(doc.id)}
                      className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Eliminar documento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {deleteConfirmDialog}
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
