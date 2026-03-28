import { useState, useMemo, useCallback } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ImportPanel } from "@/components/movements/ImportPanel";
import { MovementFiltersBar, type MovementFilters } from "@/components/movements/MovementFiltersBar";
import { MovementLedger } from "@/components/movements/MovementLedger";
import { MovementDetailDrawer } from "@/components/movements/MovementDetailDrawer";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/LoadingSkeletons";
import { Button } from "@/components/ui/button";
import { Upload, Landmark, Sparkles } from "lucide-react";
import { type BankMovement } from "@/lib/movements-data";
import { useBankTransactions, useEnrichedMovements, useUploadBankCSV, useClassifyAll } from "@/hooks/use-bank-transactions";
import type { BankTransaction, EnrichedMovement } from "@/lib/api";
import { toast } from "sonner";

/** Map backend transaction → frontend BankMovement shape.
 *  Uses persisted classification from bank_transactions columns,
 *  falls back to enriched data for entity_name (not persisted). */
function toMovement(
  tx: BankTransaction,
  enriched?: Map<number, EnrichedMovement>,
): BankMovement {
  const e = enriched?.get(tx.id);
  const classified = !!tx.category || !!tx.snc_account;
  return {
    id: String(tx.id),
    date: tx.date,
    description: tx.description,
    amount: tx.amount,
    type: tx.amount < 0 ? "debito" : "credito",
    suggestedAccount: tx.snc_account || e?.snc_account || undefined,
    sncClass: tx.snc_account || e?.snc_account || undefined,
    detectedEntity: e?.entity_name || undefined,
    classificationStatus: classified ? "classificado" : "pendente",
    reconciliationStatus: "pendente",
    confidence: classified ? 85 : 30,
    origin: "csv",
  };
}

export default function BankMovements() {
  const { data: rawTransactions = [], isLoading, isError, refetch } = useBankTransactions();
  const { data: enrichedList = [] } = useEnrichedMovements();
  const uploadCSV = useUploadBankCSV();
  const classifyAll = useClassifyAll();

  const movements = useMemo(() => {
    const enrichedMap = new Map(enrichedList.map((e) => [e.id, e]));
    return rawTransactions.map((tx) => toMovement(tx, enrichedMap));
  }, [rawTransactions, enrichedList]);

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

  if (isError) {
    return (
      <PageContainer title="Movimentos Bancários" subtitle="Importação, classificação e reconciliação de transações">
        <ErrorState onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Movimentos Bancários"
      subtitle="Importação, classificação e reconciliação de transações"
      actions={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => classifyAll.mutate()}
            disabled={classifyAll.isPending || movements.length === 0}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {classifyAll.isPending ? "A classificar..." : "Classificar tudo"}
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => setShowImport((v) => !v)}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Importar
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : isEmpty && showImport ? (
        <ImportPanel
          onImport={handleImport}
          importing={importing}
          importProgress={importProgress}
          importResult={importResult}
        />
      ) : isEmpty && !showImport ? (
        <EmptyState
          icon={Landmark}
          title="Sem movimentos bancários"
          description="Importe um extrato CSV para começar a classificar e reconciliar transações automaticamente."
          tutorial="Exporte o extrato do seu banco em formato CSV (a maioria dos bancos permite isto no homebanking). O ficheiro deve ter colunas: data, descrição e valor."
          actionLabel="Importar extrato"
          onAction={() => setShowImport(true)}
          className="py-20"
        />
      ) : !isEmpty ? (
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

          <div className="grid gap-4">
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
          </div>
        </div>
      ) : null}

      <MovementDetailDrawer
        movement={detailMv}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </PageContainer>
  );
}
