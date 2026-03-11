import { useState, useMemo, useCallback } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReconciliationCommandBar } from "@/components/reconciliation/ReconciliationCommandBar";
import { MatchCard } from "@/components/reconciliation/MatchCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { GitMerge, CheckCircle2, PartyPopper } from "lucide-react";
import { type ReconciliationPair } from "@/lib/reconciliation-data";
import { useReconciliations, useRunReconciliation, type Reconciliation } from "@/hooks/use-reconciliation";
import { toast } from "sonner";

/** Map backend Reconciliation to frontend ReconciliationPair */
function toPair(r: Reconciliation): ReconciliationPair {
  return {
    id: String(r.id),
    status: "auto-matched",
    confidence: Math.round((r.match_confidence ?? 0.95) * 100),
    reasoning: "Correspondência automática por montante e data.",
    amountDelta: r.total && r.amount ? Math.abs(Number(r.total) - Math.abs(Number(r.amount))) : 0,
    dateDelta: 0,
    document: r.supplier_nif ? {
      id: String(r.document_id),
      fileName: `documento-${r.document_id}.pdf`,
      supplier: r.supplier_nif,
      amount: Number(r.total ?? 0),
      vat: 0,
      date: r.doc_date ?? "",
      type: "Fatura",
      extractionConfidence: 85,
    } : undefined,
    movement: r.description ? {
      id: String(r.bank_transaction_id),
      description: r.description,
      amount: Number(r.amount ?? 0),
      date: r.tx_date ?? "",
    } : undefined,
  };
}

export default function Reconciliation() {
  const { data: rawReconciliations = [], isLoading } = useReconciliations();
  const runRecon = useRunReconciliation();

  const apiPairs = useMemo(() => rawReconciliations.map(toPair), [rawReconciliations]);
  const [localOverrides, setLocalOverrides] = useState<Record<string, ReconciliationPair["status"]>>({});

  const pairs = useMemo(() =>
    apiPairs.map((p) => localOverrides[p.id] ? { ...p, status: localOverrides[p.id] } : p),
    [apiPairs, localOverrides]
  );

  const [activeFilter, setActiveFilter] = useState("all");
  const running = runRecon.isPending;

  const summary = useMemo(() => {
    const s = { total: pairs.length, approved: 0, autoMatched: 0, suggested: 0, exceptions: 0, unmatched: 0 };
    pairs.forEach((p) => {
      if (p.status === "approved") s.approved++;
      else if (p.status === "auto-matched") s.autoMatched++;
      else if (p.status === "suggested") s.suggested++;
      else if (p.status === "exception") s.exceptions++;
      else if (p.status === "unmatched") s.unmatched++;
    });
    return s;
  }, [pairs]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return pairs;
    if (activeFilter === "pending") return pairs.filter((p) => p.status === "suggested" || p.status === "auto-matched");
    if (activeFilter === "matched") return pairs.filter((p) => p.status === "approved");
    if (activeFilter === "exceptions") return pairs.filter((p) => p.status === "exception");
    if (activeFilter === "unmatched") return pairs.filter((p) => p.status === "unmatched");
    return pairs;
  }, [pairs, activeFilter]);

  const handleRun = useCallback(() => {
    runRecon.mutate();
  }, [runRecon]);

  const handleApprove = useCallback((id: string) => {
    setLocalOverrides((prev) => ({ ...prev, [id]: "approved" }));
    toast.success("Par aprovado");
  }, []);

  const handleReview = useCallback((id: string) => {
    toast.info("Abrir revisão detalhada");
  }, []);

  const handleFlag = useCallback((id: string) => {
    setLocalOverrides((prev) => ({ ...prev, [id]: "exception" }));
    toast.warning("Marcado como exceção");
  }, []);

  const allResolved = summary.approved + summary.autoMatched === summary.total && summary.total > 0;

  // Group by section for "all" view
  const sections = useMemo(() => {
    if (activeFilter !== "all") return [{ title: "", items: filtered }];
    const autoAndApproved = filtered.filter((p) => p.status === "approved" || p.status === "auto-matched");
    const suggested = filtered.filter((p) => p.status === "suggested");
    const exceptions = filtered.filter((p) => p.status === "exception");
    const unmatched = filtered.filter((p) => p.status === "unmatched");

    const result: { title: string; items: ReconciliationPair[] }[] = [];
    if (suggested.length) result.push({ title: `Pendentes de Revisão (${suggested.length})`, items: suggested });
    if (exceptions.length) result.push({ title: `Exceções (${exceptions.length})`, items: exceptions });
    if (unmatched.length) result.push({ title: `Sem Par (${unmatched.length})`, items: unmatched });
    if (autoAndApproved.length) result.push({ title: `Reconciliados (${autoAndApproved.length})`, items: autoAndApproved });
    return result;
  }, [filtered, activeFilter]);

  const isEmpty = pairs.length === 0 && !isLoading;

  return (
    <PageContainer
      title="Reconciliação"
      subtitle="Correspondência entre documentos e movimentos bancários"
    >
      {isEmpty ? (
        <EmptyState
          icon={GitMerge}
          title="Sem dados para reconciliar"
          description="Importe documentos e movimentos bancários para iniciar a reconciliação automática."
          className="py-20"
        />
      ) : (
        <div className="space-y-4">
          <ReconciliationCommandBar
            summary={summary}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            running={running}
            onRun={handleRun}
          />

          {/* Success state */}
          {allResolved && (
            <div className="flex items-center gap-3 rounded-lg border border-tim-success/20 bg-tim-success/5 px-4 py-3">
              <PartyPopper className="h-5 w-5 text-tim-success" />
              <div>
                <p className="text-sm font-semibold text-foreground">Tudo reconciliado</p>
                <p className="text-xs text-muted-foreground">
                  Todos os {summary.total} pares estão aprovados ou auto-reconciliados.
                </p>
              </div>
            </div>
          )}

          {/* Running state overlay */}
          {running && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 animate-pulse-gold">
              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs font-medium text-foreground">
                A analisar correspondências entre documentos e movimentos…
              </p>
            </div>
          )}

          {/* Sections */}
          {sections.map((section, si) => (
            <div key={si}>
              {section.title && (
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </h3>
              )}
              <div className="space-y-3">
                {section.items.map((pair) => (
                  <MatchCard
                    key={pair.id}
                    pair={pair}
                    onApprove={handleApprove}
                    onReview={handleReview}
                    onFlag={handleFlag}
                  />
                ))}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <EmptyState
              title="Nenhum resultado"
              description="Sem pares nesta categoria."
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}
