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
} from "lucide-react";
import type { DocumentRecord } from "@/lib/documents-data";
import { documentTypeLabels } from "@/lib/documents-data";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";

interface DocumentListProps {
  documents: DocumentRecord[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onOpenDocument: (doc: DocumentRecord) => void;
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
  className,
}: DocumentListProps) {
  const allSelected =
    documents.length > 0 && documents.every((d) => selectedIds.has(d.id));

  const { focusedIndex, containerRef } = useKeyboardNav(documents.length);

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
