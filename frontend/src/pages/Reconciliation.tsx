import { useState, useMemo, useCallback } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReconciliationCommandBar } from "@/components/reconciliation/ReconciliationCommandBar";
import { MatchCard } from "@/components/reconciliation/MatchCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { GitMerge, CheckCircle2, PartyPopper } from "lucide-react";
import { type ReconciliationPair } from "@/lib/reconciliation-data";
import { useReconciliations, useRunReconciliation, usePatchReconciliation, type Reconciliation } from "@/hooks/use-reconciliation";
import { toast } from "sonner";

/** Map backend Reconciliation to frontend ReconciliationPair */
function toPair(r: Reconciliation): ReconciliationPair {
  const status = r.reconciliation_status === "aprovado" ? "approved"
    : r.reconciliation_status === "rejeitado" || r.reconciliation_status === "a_rever" ? "exception"
    : "auto-matched";

  const docDate = r.doc_date ? new Date(r.doc_date) : null;
  const txDate = r.tx_date ? new Date(r.tx_date) : null;
  const dateDelta = docDate && txDate
    ? Math.abs(Math.round((docDate.getTime() - txDate.getTime()) / 86400000))
    : 0;

  const confidence = Math.round((r.match_confidence ?? 0.95) * 100);
  const amountDelta = r.total && r.amount ? Math.abs(Number(r.total) - Math.abs(Number(r.amount))) : 0;

  let reasoning = "Correspondência automática por montante e data.";
  if (amountDelta < 0.01 && dateDelta <= 1) {
    reasoning = "Montante e data coincidem exatamente.";
  } else if (amountDelta < 0.01) {
    reasoning = `Montante exato, ${dateDelta} dias de diferença.`;
  } else if (dateDelta <= 1) {
    reasoning = `Data coincide, diferença de €${amountDelta.toFixed(2)} no montante.`;
  }

  return {
    id: String(r.id),
    status,
    confidence,
    reasoning,
    amountDelta,
    dateDelta,
    document: r.supplier_nif ? {
      id: String(r.document_id),
      fileName: r.doc_filename || `documento-${r.document_id}.pdf`,
      supplier: r.supplier_nif,
      amount: Number(r.total ?? 0),
      vat: Number(r.doc_vat ?? 0),
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
  const { data: rawReconciliations = [], isLoading, isError, refetch } = useReconciliations();
  const runRecon = useRunReconciliation();
  const patchRecon = usePatchReconciliation();

  const pairs = useMemo(() => rawReconciliations.map(toPair), [rawReconciliations]);

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
    patchRecon.mutate({ id: Number(id), status: "aprovado" });
    toast.success("Par aprovado");
  }, [patchRecon]);

  const handleReview = useCallback((id: string) => {
    patchRecon.mutate({ id: Number(id), status: "a_rever" });
    toast.info("Marcado para revisão");
  }, [patchRecon]);

  const handleFlag = useCallback((id: string) => {
    patchRecon.mutate({ id: Number(id), status: "rejeitado" });
    toast.warning("Marcado como exceção");
  }, [patchRecon]);

  const allResolved = summary.approved === summary.total && summary.total > 0;

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

  if (isError) {
    return (
      <PageContainer title="Reconciliação" subtitle="Correspondência entre documentos e movimentos bancários">
        <ErrorState onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Reconciliação"
      subtitle="Correspondência entre documentos e movimentos bancários"
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      ) : isEmpty ? (
        <EmptyState
          illustration="🔗"
          title="Pronto para reconciliar"
          description="Importe documentos e movimentos bancários — o sistema encontra as correspondências automaticamente."
          tutorial="A reconciliação liga cada fatura ao respetivo pagamento no banco. Comece por carregar faturas e o extrato CSV."
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
