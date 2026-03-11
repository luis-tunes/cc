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

  return (
    <div className={cn("rounded-lg border bg-card overflow-x-auto", className)}>
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
              />
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Documento
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tipo
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Entidade / NIF
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">
              Total
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">
              IVA
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Data
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Extração
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Estado
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => {
            const FileIcon = doc.fileType === "pdf" ? FileText : Image;
            const SourceIcon = sourceIcon[doc.source];
            const isLowConf = doc.extractionConfidence < 60;

            return (
              <TableRow
                key={doc.id}
                className={cn(
                  "border-border cursor-pointer transition-colors",
                  isLowConf && "bg-tim-warning/[0.03]",
                  selectedIds.has(doc.id) && "bg-accent/50"
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
                  <div className="flex items-center gap-2">
                    <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground max-w-[200px]">
                        {doc.fileName}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <SourceIcon className="h-2.5 w-2.5 text-muted-foreground/60" />
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(doc.uploadedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {documentTypeLabels[doc.documentType]}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-foreground max-w-[140px]">
                      {doc.supplier || doc.customer || "—"}
                    </p>
                    {doc.nif && (
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {doc.nif}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    "text-xs font-mono font-medium",
                    doc.total && doc.total < 0 ? "text-tim-danger" : "text-foreground"
                  )}>
                    {doc.total != null ? formatCurrency(doc.total) : "—"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-xs font-mono text-muted-foreground">
                    {doc.vat != null ? formatCurrency(doc.vat) : "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {doc.date || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <ConfidenceIndicator value={doc.extractionConfidence} size="sm" />
                </TableCell>
                <TableCell>
                  <StatusBadge status={doc.classificationStatus} />
                </TableCell>
                <TableCell>
                  {doc.needsReview && (
                    <AlertTriangle className="h-3.5 w-3.5 text-tim-warning" />
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
