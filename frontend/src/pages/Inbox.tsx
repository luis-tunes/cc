import { useState, useMemo, useCallback } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { IntakeZone } from "@/components/documents/IntakeZone";
import { DocumentFiltersBar, type DocumentFilters } from "@/components/documents/DocumentFiltersBar";
import { DocumentList } from "@/components/documents/DocumentList";
import { BulkActionsBar } from "@/components/documents/BulkActionsBar";
import { DocumentReviewDrawer } from "@/components/documents/DocumentReviewDrawer";
import { DocumentReviewPanel } from "@/components/documents/DocumentReviewPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { type DocumentRecord, type UploadingFile } from "@/lib/documents-data";
import { uploadDocument } from "@/lib/api";
import { useDocuments } from "@/hooks/use-documents";
import { useDocumentActions } from "@/hooks/use-document-actions";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

export default function InboxPage() {
  const { documents: allDocuments, isLoading, error, refetch } = useDocuments();
  const { actions } = useDocumentActions(refetch);
  const isMobile = useIsMobile();
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
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

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
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
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
        const result = await uploadDocument(file);
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
          if (result?.status === "accepted_without_ocr") {
            toast.warning(`${item.name} — guardado, mas OCR indisponível. Será processado quando o serviço estiver ativo.`);
          } else {
            toast.success(`${item.name} — enviado para processamento OCR`);
          }
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
    if (isMobile) setDrawerOpen(true);
  }, [isMobile]);

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
      {error ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : isEmpty && showIntake ? (
        <IntakeZone
          uploadQueue={uploadQueue}
          onUpload={handleUpload}
          onDismiss={handleDismissUpload}
        />
      ) : isEmpty && !showIntake ? (
        /* First-use empty state */
        <EmptyState
          illustration="📬"
          title="A caixa de entrada está vazia"
          description="Importe a sua primeira fatura, recibo ou nota de crédito. O xtim.ai extrai os campos automaticamente e sugere classificações — em segundos."
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
            onDelete={() => setBulkDeleteOpen(true)}
            onClear={() => setSelectedIds(new Set())}
          />

          {/* Document list + side panel */}
          <div className={reviewDoc && !isMobile ? "flex gap-4" : ""}>
            <div className={reviewDoc && !isMobile ? "w-[55%] min-w-0" : "w-full"}>
              {filtered.length > 0 ? (
                <DocumentList
                  documents={filtered}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onToggleAll={toggleAll}
                  onOpenDocument={openDocument}
                  onDelete={actions.onDelete}
                />
              ) : (
                <EmptyState
                  title="Nenhum documento encontrado"
                  description="Ajuste os filtros ou importe novos documentos."
                />
              )}
            </div>

            {/* Desktop: inline side panel */}
            {reviewDoc && !isMobile && (
              <div className="w-[45%] min-w-0">
                <DocumentReviewPanel
                  document={allDocuments.find((d) => d.id === reviewDoc.id) || reviewDoc}
                  actions={actions}
                  onClose={() => setReviewDoc(null)}
                />
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Mobile: review drawer */}
      {isMobile && (
        <DocumentReviewDrawer
          document={reviewDoc}
          open={drawerOpen}
          onClose={() => { setDrawerOpen(false); setReviewDoc(null); }}
          actions={actions}
        />
      )}

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Eliminar ${selectedIds.size} documento${selectedIds.size === 1 ? "" : "s"}`}
        description="Tem a certeza que pretende eliminar os documentos selecionados? Esta ação não pode ser desfeita."
        confirmLabel="Eliminar"
        onConfirm={() => { actions.onBulkDelete([...selectedIds]); setSelectedIds(new Set()); setBulkDeleteOpen(false); }}
      />
    </PageContainer>
  );
}
