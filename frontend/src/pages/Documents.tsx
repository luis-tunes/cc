import { useState, useMemo, useCallback } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { DocumentList } from "@/components/documents/DocumentList";
import { DocumentFiltersBar, type DocumentFilters } from "@/components/documents/DocumentFiltersBar";
import { DocumentReviewDrawer } from "@/components/documents/DocumentReviewDrawer";
import { BulkActionsBar } from "@/components/documents/BulkActionsBar";
import { GlobalUploadModal } from "@/components/global/GlobalUploadModal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Upload,
} from "lucide-react";
import { type DocumentRecord } from "@/lib/documents-data";
import { useDocuments } from "@/hooks/use-documents";
import { useDocumentActions } from "@/hooks/use-document-actions";
import { downloadWithAuth } from "@/lib/api";
import { toast } from "sonner";
import { TableSkeleton, KpiSkeleton } from "@/components/shared/LoadingSkeletons";
import { ErrorState } from "@/components/shared/ErrorState";

type ViewTab = "todos" | "revisao" | "classificados" | "reconciliados";

export default function Documents() {
  const { documents, isLoading, error, refetch } = useDocuments();
  const { actions } = useDocumentActions(refetch);
  const [filters, setFilters] = useState<DocumentFilters>({
    search: "",
    status: "all",
    documentType: "all",
    needsReview: null,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeDoc, setActiveDoc] = useState<DocumentRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>("todos");

  const filtered = useMemo(() => {
    let docs = [...documents];
    if (activeTab === "revisao") docs = docs.filter((d) => d.needsReview);
    if (activeTab === "classificados")
      docs = docs.filter(
        (d) => d.classificationStatus === "classificado" || d.classificationStatus === "revisto"
      );
    if (activeTab === "reconciliados")
      docs = docs.filter((d) => d.reconciliationStatus === "reconciliado");
    if (filters.search) {
      const q = filters.search.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.fileName.toLowerCase().includes(q) ||
          d.supplier?.toLowerCase().includes(q) ||
          d.customer?.toLowerCase().includes(q) ||
          d.nif?.includes(q)
      );
    }
    if (filters.status !== "all")
      docs = docs.filter((d) => d.classificationStatus === filters.status);
    if (filters.documentType !== "all")
      docs = docs.filter((d) => d.documentType === filters.documentType);
    if (filters.needsReview === true)
      docs = docs.filter((d) => d.needsReview);
    return docs;
  }, [documents, filters, activeTab]);

  const kpis = useMemo(() => {
    const total = documents.length;
    const pendingReview = documents.filter((d) => d.needsReview).length;
    const classified = documents.filter(
      (d) => d.classificationStatus === "classificado" || d.classificationStatus === "revisto"
    ).length;
    const reconciled = documents.filter(
      (d) => d.reconciliationStatus === "reconciliado"
    ).length;
    return { total, pendingReview, classified, reconciled };
  }, [documents]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map((d) => d.id))
    );
  }, [filtered]);

  const handleOpenDocument = useCallback((doc: DocumentRecord) => {
    setActiveDoc(doc);
    setDrawerOpen(true);
  }, []);

  const bulkApprove = useCallback(() => {
    const ids = [...selectedIds];
    for (const id of ids) {
      actions.onApprove(id);
    }
    toast.success(`${ids.length} documentos aprovados`);
    setSelectedIds(new Set());
  }, [selectedIds, actions]);

  const bulkArchive = useCallback(() => {
    const ids = [...selectedIds];
    for (const id of ids) {
      actions.onArchive(id);
    }
    toast.success(`${ids.length} documentos arquivados`);
    setSelectedIds(new Set());
  }, [selectedIds, actions]);

  const bulkExport = useCallback(() => {
    downloadWithAuth("/export/csv", "documentos.csv");
  }, []);

  const bulkStub = (action: string) => {
    toast.success(`${action}: ${selectedIds.size} documentos`);
    setSelectedIds(new Set());
  };

  const pendingHighConfidence = useMemo(
    () => documents.filter((d) => d.classificationStatus === "pendente" && d.extractionConfidence >= 80).length,
    [documents]
  );

  const handleApproveAll = useCallback(() => {
    const toApprove = documents.filter(
      (d) => d.classificationStatus === "pendente" && d.extractionConfidence >= 80
    );
    for (const doc of toApprove) {
      actions.onApprove(doc.id);
    }
    toast.success(`${toApprove.length} documentos aprovados automaticamente`);
  }, [documents, actions]);

  const handleDocumentProcessed = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <PageContainer
      title="Documentos"
      subtitle="Gestão de faturas, recibos e outros documentos fiscais"
      actions={
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={() => setUploadOpen(true)}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Carregar ficheiros
        </Button>
      }
    >
      <div className="space-y-4">
        {/* KPI Row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total Documentos" value={String(kpis.total)} icon={FileText} compact />
          <KpiCard label="Pendentes Revisão" value={String(kpis.pendingReview)} icon={AlertTriangle} variant={kpis.pendingReview > 0 ? "warning" : "default"} compact />
          <KpiCard label="Classificados" value={String(kpis.classified)} icon={CheckCircle2} compact />
          <KpiCard label="Reconciliados" value={String(kpis.reconciled)} icon={Clock} compact />
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as ViewTab);
            setSelectedIds(new Set());
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <TabsList className="h-8 bg-secondary/50">
              <TabsTrigger value="todos" className="text-xs h-6 px-3">Todos</TabsTrigger>
              <TabsTrigger value="revisao" className="text-xs h-6 px-3">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Revisão ({kpis.pendingReview})
              </TabsTrigger>
              <TabsTrigger value="classificados" className="text-xs h-6 px-3">Classificados</TabsTrigger>
              <TabsTrigger value="reconciliados" className="text-xs h-6 px-3">Reconciliados</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        {/* Filters */}
        <DocumentFiltersBar filters={filters} onChange={setFilters} resultCount={filtered.length} />

        {/* Bulk Actions */}
        <BulkActionsBar
          selectedCount={selectedIds.size}
          pendingHighConfidence={pendingHighConfidence}
          onApprove={bulkApprove}
          onApproveAll={handleApproveAll}
          onClassify={() => bulkStub("Classificados")}
          onFlag={() => bulkStub("Sinalizados")}
          onExport={bulkExport}
          onArchive={bulkArchive}
          onClear={() => setSelectedIds(new Set())}
        />

        {/* Document List */}
        {error ? (
          <ErrorState onRetry={refetch} />
        ) : isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : filtered.length > 0 ? (
          <DocumentList
            documents={filtered}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleAll={handleToggleAll}
            onOpenDocument={handleOpenDocument}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 py-16">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-foreground">Nenhum documento encontrado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {documents.length === 0
                ? "Carregue o seu primeiro documento para começar"
                : "Ajuste os filtros ou carregue novos documentos"}
            </p>
            <Button size="sm" variant="outline" className="mt-4 h-8 text-xs" onClick={() => setUploadOpen(true)}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Carregar documentos
            </Button>
          </div>
        )}
      </div>

      {/* Review Drawer */}
      <DocumentReviewDrawer
        document={activeDoc ? documents.find((d) => d.id === activeDoc.id) || activeDoc : null}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        actions={actions}
      />

      {/* Unified Upload Modal */}
      <GlobalUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onDocumentProcessed={handleDocumentProcessed}
      />
    </PageContainer>
  );
}
