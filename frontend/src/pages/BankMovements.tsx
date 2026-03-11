import { useState, useMemo, useCallback } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ImportPanel } from "@/components/movements/ImportPanel";
import { MovementFiltersBar, type MovementFilters } from "@/components/movements/MovementFiltersBar";
import { MovementLedger } from "@/components/movements/MovementLedger";
import { AiClassificationRail } from "@/components/movements/AiClassificationRail";
import { MovementDetailDrawer } from "@/components/movements/MovementDetailDrawer";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Upload, Landmark } from "lucide-react";
import { classificationSummary, type BankMovement } from "@/lib/movements-data";
import { useBankTransactions, useUploadBankCSV } from "@/hooks/use-bank-transactions";
import { toast } from "sonner";

/** Map backend BankTransaction → frontend BankMovement shape */
function toMovement(tx: { id: number; date: string; description: string; amount: number }): BankMovement {
  return {
    id: String(tx.id),
    date: tx.date,
    description: tx.description,
    amount: tx.amount,
    type: tx.amount < 0 ? "debito" : "credito",
    classificationStatus: "pendente",
    reconciliationStatus: "pendente",
    confidence: 50,
    origin: "csv",
  };
}

export default function BankMovements() {
  const { data: rawTransactions = [], isLoading } = useBankTransactions();
  const uploadCSV = useUploadBankCSV();

  const movements = useMemo(() => rawTransactions.map(toMovement), [rawTransactions]);

  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  const [filters, setFilters] = useState<MovementFilters>({
    search: "",
    classification: "all",
    reconciliation: "all",
    type: "all",
    anomaly: "all",
    confidence: "all",
  });

  const [detailMv, setDetailMv] = useState<BankMovement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    return movements.filter((mv) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = [mv.description, mv.reference, mv.detectedEntity].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.classification === "classified" && mv.classificationStatus !== "classificado" && mv.classificationStatus !== "revisto") return false;
      if (filters.classification === "unclassified" && (mv.classificationStatus === "classificado" || mv.classificationStatus === "revisto")) return false;
      if (filters.reconciliation === "reconciled" && mv.reconciliationStatus !== "reconciliado") return false;
      if (filters.reconciliation === "unreconciled" && mv.reconciliationStatus === "reconciliado") return false;
      if (filters.type !== "all" && mv.type !== filters.type) return false;
      if (filters.anomaly === "anomaly" && !mv.isAnomaly) return false;
      if (filters.anomaly === "duplicate" && !mv.isDuplicate) return false;
      if (filters.confidence === "high" && mv.confidence < 80) return false;
      if (filters.confidence === "medium" && (mv.confidence < 50 || mv.confidence >= 80)) return false;
      if (filters.confidence === "low" && mv.confidence >= 50) return false;
      return true;
    });
  }, [movements, filters]);

  const handleImport = useCallback((file: File) => {
    setImporting(true);
    setImportResult(null);
    setImportProgress(10);

    uploadCSV.mutate(file, {
      onSuccess: (data) => {
        setImportProgress(100);
        setImporting(false);
        setImportResult({ success: data.imported, failed: 0 });
      },
      onError: () => {
        setImportProgress(100);
        setImporting(false);
        setImportResult({ success: 0, failed: 1 });
      },
    });
  }, [uploadCSV]);

  const openMovement = useCallback((mv: BankMovement) => {
    setDetailMv(mv);
    setDrawerOpen(true);
  }, []);

  const isEmpty = movements.length === 0 && !isLoading;

  return (
    <PageContainer
      title="Movimentos Bancários"
      subtitle="Importação, classificação e reconciliação de transações"
      actions={
        <Button size="sm" className="h-8 text-xs" onClick={() => setShowImport((v) => !v)}>
          <Upload className="mr-1 h-3 w-3" /> Importar
        </Button>
      }
    >
      {isEmpty ? (
        <EmptyState
          icon={Landmark}
          title="Sem movimentos bancários"
          description="Importe um extrato CSV para começar a classificar e reconciliar transações automaticamente."
          actionLabel="Importar extrato"
          onAction={() => setShowImport(true)}
          className="py-20"
        />
      ) : (
        <div className="space-y-4">
          {showImport && (
            <ImportPanel
              onImport={handleImport}
              importing={importing}
              importProgress={importProgress}
              importResult={importResult}
            />
          )}

          <MovementFiltersBar
            filters={filters}
            onChange={setFilters}
            resultCount={filtered.length}
          />

          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            {/* Ledger */}
            <div>
              {filtered.length > 0 ? (
                <MovementLedger
                  movements={filtered}
                  onOpenMovement={openMovement}
                />
              ) : (
                <EmptyState
                  title="Nenhum movimento encontrado"
                  description="Ajuste os filtros ou importe novos movimentos."
                />
              )}
            </div>

            {/* AI Rail */}
            <AiClassificationRail summary={classificationSummary} />
          </div>
        </div>
      )}

      <MovementDetailDrawer
        movement={detailMv}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </PageContainer>
  );
}
