import { cn } from "@/lib/utils";
import { StatusBadge, type StatusType } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Image,
  Play,
  Trash2,
  Eye,
  Download,
  Loader2,
} from "lucide-react";
import type { DocumentRecord } from "@/lib/documents-data";
import { documentTypeLabels } from "@/lib/documents-data";

interface PipelineColumn {
  id: string;
  label: string;
  emoji: string;
  status: StatusType;
  docs: DocumentRecord[];
}

interface DocumentPipelineProps {
  documents: DocumentRecord[];
  onOpenDocument: (doc: DocumentRecord) => void;
  onDelete?: (id: string) => void;
  onProcess?: (id: string) => void;
  className?: string;
}

function getColumnDocs(documents: DocumentRecord[]): PipelineColumn[] {
  return [
    {
      id: "staging",
      label: "Staging",
      emoji: "📤",
      status: "staging" as StatusType,
      docs: documents.filter((d) => d.classificationStatus === "staging"),
    },
    {
      id: "processing",
      label: "A Processar",
      emoji: "⚙",
      status: "pendente" as StatusType,
      docs: documents.filter((d) =>
        ["pendente"].includes(d.classificationStatus) && !d.needsReview
      ),
    },
    {
      id: "review",
      label: "Para Rever",
      emoji: "👁",
      status: "extraído" as StatusType,
      docs: documents.filter((d) =>
        d.classificationStatus === "extraído" || (d.classificationStatus === "pendente" && d.needsReview)
      ),
    },
    {
      id: "done",
      label: "Concluído",
      emoji: "✅",
      status: "classificado" as StatusType,
      docs: documents.filter((d) =>
        ["classificado", "revisto", "reconciliado"].includes(d.classificationStatus)
      ),
    },
  ];
}

export function DocumentPipeline({
  documents,
  onOpenDocument,
  onDelete,
  onProcess,
  className,
}: DocumentPipelineProps) {
  const columns = getColumnDocs(documents);

  return (
    <div className={cn("flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory", className)}>
      {columns.map((col) => (
        <div
          key={col.id}
          className="flex min-w-[280px] max-w-[320px] flex-1 snap-start flex-col rounded-lg border bg-card"
        >
          {/* Column header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-base">{col.emoji}</span>
              <h3 className="text-sm font-semibold">{col.label}</h3>
            </div>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {col.docs.length}
            </span>
          </div>

          {/* Column cards */}
          <div className="flex-1 space-y-2 overflow-y-auto p-3" style={{ maxHeight: "60vh" }}>
            {col.docs.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Nenhum documento
              </p>
            )}
            {col.docs.map((doc) => {
              const FileIcon = doc.fileType === "pdf" ? FileText : Image;
              return (
                <div
                  key={doc.id}
                  onClick={() => onOpenDocument(doc)}
                  className="cursor-pointer rounded-md border bg-background p-3 transition-all hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <FileIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{doc.fileName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {documentTypeLabels[doc.documentType]}
                      </p>
                      {doc.date && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{doc.date}</p>
                      )}
                      {doc.total != null && (
                        <p className="mt-1 text-sm font-mono font-medium">
                          €{Math.abs(doc.total).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Column-specific actions */}
                  {col.id === "staging" && (
                    <div className="mt-2 flex gap-1.5">
                      {onProcess && (
                        <Button
                          size="sm"
                          className="h-6 text-xs flex-1 bg-tim-success hover:bg-tim-success/90"
                          onClick={(e) => { e.stopPropagation(); onProcess(doc.id); }}
                        >
                          <Play className="mr-1 h-3 w-3" /> Processar
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs text-tim-danger"
                          onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                  {col.id === "processing" && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      A processar…
                    </div>
                  )}
                  {col.id === "review" && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        className="h-6 w-full text-xs"
                        onClick={(e) => { e.stopPropagation(); onOpenDocument(doc); }}
                      >
                        <Eye className="mr-1 h-3 w-3" /> Rever e aprovar
                      </Button>
                    </div>
                  )}
                  {col.id === "done" && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <StatusBadge status={doc.classificationStatus} className="text-xs" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
