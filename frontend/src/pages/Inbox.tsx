import { useState, useMemo, useCallback } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { IntakeZone } from "@/components/documents/IntakeZone";
import { DocumentFiltersBar, type DocumentFilters } from "@/components/documents/DocumentFiltersBar";
import { DocumentList } from "@/components/documents/DocumentList";
import { BulkActionsBar } from "@/components/documents/BulkActionsBar";
import { DocumentReviewDrawer } from "@/components/documents/DocumentReviewDrawer";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { type DocumentRecord, type UploadingFile } from "@/lib/documents-data";
import { uploadDocument } from "@/lib/api";
import { useDocuments } from "@/hooks/use-documents";
import { useDocumentActions } from "@/hooks/use-document-actions";
import { toast } from "sonner";

export default function InboxPage() {
  const { documents: allDocuments, refetch } = useDocuments();
  const { actions } = useDocumentActions(refetch);
  const [uploadQueue, setUploadQueue] = useState<UploadingFile[]>([]);
  const [showIntake, setShowIntake] = useState(false);

  // Filters
  const [filters, setFilters] = useState<DocumentFilters>({
    search: "",
    status: "all",
    documentType: "all",
    needsReview: null,
  });

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Review drawer
  const [reviewDoc, setReviewDoc] = useState<DocumentRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filter documents
  const filtered = useMemo(() => {
    return allDocuments.filter((doc) => {
      if (filters.status !== "all" && doc.classificationStatus !== filters.status)
        return false;
      if (filters.documentType !== "all" && doc.documentType !== filters.documentType)
        return false;
      if (filters.needsReview === true && !doc.needsReview) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const haystack = [
          doc.fileName,
          doc.supplier,
          doc.customer,
          doc.nif,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [filters]);

  // Real upload handler — sends to /api/documents/upload
  const handleUpload = useCallback((files: File[]) => {
    const newItems: UploadingFile[] = files.map((f, i) => ({
      id: `up-${Date.now()}-${i}`,
      name: f.name,
      size: f.size,
      progress: 0,
      status: "uploading" as const,
    }));
    setUploadQueue((prev) => [...prev, ...newItems]);
    setShowIntake(true);

    // Upload each file to the API
    newItems.forEach(async (item, idx) => {
      const file = files[idx];

      // Show progress animation
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90; // cap at 90% until API responds
        setUploadQueue((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, progress } : f))
        );
      }, 200);

      try {
        await uploadDocument(file);
        clearInterval(interval);
        setUploadQueue((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, progress: 100, status: "processing" } : f
          )
        );
        // After a short delay, mark as extracted and refetch
        setTimeout(() => {
          setUploadQueue((prev) =>
            prev.map((f) =>
              f.id === item.id ? { ...f, status: "extracted" } : f
            )
          );
          toast.success(`${item.name} — enviado para processamento OCR`);
          refetch();
        }, 1000);
      } catch (err: any) {
        clearInterval(interval);
        setUploadQueue((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: "failed", error: err.message || "Erro no upload" }
              : f
          )
        );
        toast.error(`${item.name} — falha no upload`);
      }
    });
  }, [refetch]);

  const handleDismissUpload = useCallback((id: string) => {
    setUploadQueue((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map((d) => d.id))
    );
  }, [filtered]);

  const openDocument = useCallback((doc: DocumentRecord) => {
    setReviewDoc(doc);
    setDrawerOpen(true);
  }, []);

  const bulkAction = (action: string) => {
    toast.info(`${action}: ${selectedIds.size} documentos`);
    setSelectedIds(new Set());
  };

  const isEmpty = allDocuments.length === 0;

  return (
    <PageContainer
      title="Caixa de Entrada"
      subtitle="Importação, extração e revisão de documentos"
      actions={
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={() => setShowIntake((v) => !v)}
        >
          <Upload className="mr-1 h-3 w-3" />
          Importar
        </Button>
      }
    >
      {isEmpty && showIntake && (
        <IntakeZone
          uploadQueue={uploadQueue}
          onUpload={handleUpload}
          onDismiss={handleDismissUpload}
        />
      )}

      {isEmpty && !showIntake ? (
        /* First-use empty state */
        <EmptyState
          icon={FileText}
          title="Nenhum documento importado"
          description="Comece por importar faturas, recibos ou outros documentos. O TIM irá extrair automaticamente os campos relevantes e sugerir classificações."
          actionLabel="Importar primeiro documento"
          onAction={() => setShowIntake(true)}
          className="py-20"
        />
      ) : !isEmpty ? (
        <div className="space-y-4">
          {/* Intake zone (collapsible) */}
          {showIntake && (
            <IntakeZone
              uploadQueue={uploadQueue}
              onUpload={handleUpload}
              onDismiss={handleDismissUpload}
            />
          )}

          {/* Filters */}
          <DocumentFiltersBar
            filters={filters}
            onChange={setFilters}
            resultCount={filtered.length}
          />

          {/* Bulk actions */}
          <BulkActionsBar
            selectedCount={selectedIds.size}
            onApprove={() => bulkAction("Aprovar")}
            onClassify={() => bulkAction("Classificar")}
            onFlag={() => bulkAction("Sinalizar")}
            onExport={() => bulkAction("Exportar")}
            onArchive={() => bulkAction("Arquivar")}
            onClear={() => setSelectedIds(new Set())}
          />

          {/* Document list */}
          {filtered.length > 0 ? (
            <DocumentList
              documents={filtered}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
              onOpenDocument={openDocument}
            />
          ) : (
            <EmptyState
              title="Nenhum documento encontrado"
              description="Ajuste os filtros ou importe novos documentos."
            />
          )}
        </div>
      )}

      {/* Review drawer */}
      <DocumentReviewDrawer
        document={reviewDoc}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        actions={actions}
      />
    </PageContainer>
  );
}
