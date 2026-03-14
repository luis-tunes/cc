import { useDocuments } from "@/hooks/use-documents";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FileText, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
  } catch {
    return d;
  }
}

function formatEUR(v: string | number | undefined): string {
  if (v === undefined || v === null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return `€${n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RecentDocumentsFeed({ className }: { className?: string }) {
  const { documents, isLoading } = useDocuments();
  const docs = documents.slice(0, 6);

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Documentos Recentes</h3>
        <Link
          to="/documentos"
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
        >
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0">
              <div className="h-7 w-7 rounded bg-muted animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-32 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
              </div>
              <div className="h-3 w-12 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
          <FileText className="h-8 w-8 opacity-30" />
          <p className="text-xs">Nenhum documento ainda</p>
        </div>
      ) : (
        <div>
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {doc.supplier || "—"} · {doc.documentType}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {doc.date ? formatDate(doc.date) : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-medium text-foreground">{formatEUR(doc.total)}</span>
                <StatusBadge status={doc.classificationStatus} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
