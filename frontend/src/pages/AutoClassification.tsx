import { useState, useCallback } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ClassificationWorkflowQueue } from "@/components/classifications/ClassificationWorkflowQueue";
import { ClassificationDetailPanel } from "@/components/classifications/ClassificationDetailPanel";
import { ClassificationBulkBar } from "@/components/classifications/ClassificationBulkBar";
import { KpiCard } from "@/components/shared/KpiCard";
import { autoClassificationQueue, type AutoClassificationItem, queueSummary } from "@/lib/auto-classification-data";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, AlertTriangle, Brain, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function AutoClassification() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AutoClassificationItem[]>(autoClassificationQueue);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<AutoClassificationItem | null>(null);

  const pendingCount = items.filter((i) => i.status === "pendente" || i.status === "sugerido").length;
  const approvedCount = items.filter((i) => i.status === "aprovado" || i.status === "editado").length;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const pending = items.filter((i) => i.status === "pendente" || i.status === "sugerido");
    if (selectedIds.size === pending.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pending.map((i) => i.id)));
    }
  }, [items, selectedIds]);

  const approve = useCallback((id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "aprovado" as const } : i)));
    setActiveItem((prev) => (prev?.id === id ? { ...prev, status: "aprovado" as const } : prev));
    toast.success("Classificação aprovada");
  }, []);

  const reject = useCallback((id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "rejeitado" as const } : i)));
    setActiveItem((prev) => (prev?.id === id ? { ...prev, status: "rejeitado" as const } : prev));
    toast.success("Classificação rejeitada");
  }, []);

  const edit = useCallback((id: string, account: string, cls: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, suggestedAccount: account, suggestedClass: cls, status: "editado" as const } : i
      )
    );
    setActiveItem((prev) =>
      prev?.id === id ? { ...prev, suggestedAccount: account, suggestedClass: cls, status: "editado" as const } : prev
    );
    toast.success("Classificação editada e aprovada");
  }, []);

  const createRule = useCallback((id: string) => {
    const item = items.find((i) => i.id === id);
    if (item?.detectedEntity) {
      toast.success(`Regra criada: ${item.detectedEntity} → ${item.suggestedAccount}`);
    }
  }, [items]);

  const markRecurring = useCallback((id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isRecurring: true } : i)));
    setActiveItem((prev) => (prev?.id === id ? { ...prev, isRecurring: true } : prev));
    toast.success("Marcado como recorrente");
  }, []);

  const bulkApprove = useCallback(() => {
    setItems((prev) => prev.map((i) => (selectedIds.has(i.id) ? { ...i, status: "aprovado" as const } : i)));
    toast.success(`${selectedIds.size} classificações aprovadas`);
    setSelectedIds(new Set());
  }, [selectedIds]);

  const bulkReject = useCallback(() => {
    setItems((prev) => prev.map((i) => (selectedIds.has(i.id) ? { ...i, status: "rejeitado" as const } : i)));
    toast.success(`${selectedIds.size} classificações rejeitadas`);
    setSelectedIds(new Set());
  }, [selectedIds]);

  const bulkRecurring = useCallback(() => {
    setItems((prev) => prev.map((i) => (selectedIds.has(i.id) ? { ...i, isRecurring: true } : i)));
    toast.success(`${selectedIds.size} movimentos marcados como recorrentes`);
    setSelectedIds(new Set());
  }, [selectedIds]);

  const bulkCreateRules = useCallback(() => {
    const withEntities = items.filter((i) => selectedIds.has(i.id) && i.detectedEntity && !i.supplierRule?.exists);
    toast.success(`${withEntities.length} regras de fornecedor criadas`);
    setSelectedIds(new Set());
  }, [items, selectedIds]);

  return (
    <PageContainer
      title="Auto-Classificação"
      subtitle="Revisão e aprovação de classificações sugeridas pela IA"
      actions={
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate("/classificacoes")}>
          <ArrowLeft className="mr-1 h-3 w-3" /> Voltar às Classificações
        </Button>
      }
    >
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard
          label="Pendentes"
          value={String(pendingCount)}
          icon={Sparkles}
          trend={{ value: `de ${items.length} movimentos`, direction: "neutral" }}
        />
        <KpiCard
          label="Aprovados"
          value={String(approvedCount)}
          icon={CheckCircle2}
          trend={{ value: "nesta sessão", direction: "up" }}
        />
        <KpiCard
          label="Anomalias"
          value={String(items.filter((i) => i.isAnomaly).length)}
          icon={AlertTriangle}
          variant="warning"
          trend={{ value: "requerem atenção", direction: "neutral" }}
        />
        <KpiCard
          label="Com regra"
          value={String(items.filter((i) => i.supplierRule?.exists).length)}
          icon={Brain}
          trend={{ value: `de ${items.length} total`, direction: "neutral" }}
        />
      </div>

      {/* Bulk bar */}
      <ClassificationBulkBar
        selectedCount={selectedIds.size}
        onApproveAll={bulkApprove}
        onRejectAll={bulkReject}
        onMarkRecurring={bulkRecurring}
        onCreateRules={bulkCreateRules}
        onClear={() => setSelectedIds(new Set())}
        className="mt-4"
      />

      {/* Main layout */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <ClassificationWorkflowQueue
          items={items}
          selectedIds={selectedIds}
          activeId={activeItem?.id ?? null}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          onOpenDetail={(item) => setActiveItem(item)}
          onApprove={approve}
          onReject={reject}
          onMarkRecurring={markRecurring}
        />

        <ClassificationDetailPanel
          item={activeItem}
          onApprove={approve}
          onReject={reject}
          onEdit={edit}
          onCreateRule={createRule}
          onMarkRecurring={markRecurring}
          className="sticky top-4 max-h-[calc(100vh-8rem)] overflow-y-auto"
        />
      </div>
    </PageContainer>
  );
}
