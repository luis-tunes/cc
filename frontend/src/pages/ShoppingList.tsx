import { useState, useMemo, useCallback } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ShoppingListTable } from "@/components/shopping/ShoppingListTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShoppingCart, AlertTriangle, AlertCircle, Euro, Loader2, Download,
} from "lucide-react";
import { useShoppingList, useCreateStockEvent } from "@/hooks/use-inventory";
import { toast } from "sonner";
import type { ShoppingListItem } from "@/lib/api";

const eur = (v: number) => `€\u202f${v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ShoppingList() {
  const { data: items = [], isLoading, isError, refetch } = useShoppingList();
  const createEvent = useCreateStockEvent();

  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<"none" | "supplier" | "urgency">("urgency");
  const [orderedIds, setOrderedIds] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !item.name.toLowerCase().includes(q) &&
          !(item.supplier_name && item.supplier_name.toLowerCase().includes(q))
        ) return false;
      }
      if (urgencyFilter !== "all" && item.urgency !== urgencyFilter) return false;
      return true;
    });
  }, [items, search, urgencyFilter]);

  const urgenteCount = useMemo(() => items.filter((i) => i.urgency === "urgente").length, [items]);
  const altaCount = useMemo(() => items.filter((i) => i.urgency === "alta").length, [items]);
  const totalEstimate = useMemo(
    () => items.reduce((sum, i) => sum + i.suggested_qty * i.avg_price, 0),
    [items]
  );

  const handleMarkOrdered = useCallback((item: ShoppingListItem) => {
    createEvent.mutate(
      {
        type: "entrada",
        ingredient_id: item.ingredient_id,
        qty: item.suggested_qty,
        unit: item.unit,
        source: "compra",
        reference: `Encomenda ${item.supplier_name || "manual"}`,
        cost: item.avg_price * item.suggested_qty,
      },
      {
        onSuccess: () => {
          setOrderedIds((prev) => new Set(prev).add(item.ingredient_id));
        },
      }
    );
  }, [createEvent]);

  const handleExportCSV = useCallback(() => {
    const rows = [
      ["Ingrediente", "Fornecedor", "Qty", "Unidade", "Preço Médio", "Estimativa", "Urgência"],
      ...filtered.map((i) => [
        i.name,
        i.supplier_name || "",
        String(i.suggested_qty),
        i.unit,
        String(i.avg_price),
        String(i.suggested_qty * i.avg_price),
        i.urgency,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lista-compras-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Lista exportada");
  }, [filtered]);

  if (isLoading) {
    return (
      <PageContainer title="Lista de Compras" subtitle="Ingredientes por repor">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-tim-gold" />
        </div>
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer title="Lista de Compras" subtitle="Ingredientes por repor">
        <ErrorState onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Lista de Compras"
      subtitle="Ingredientes por repor com base no stock mínimo"
      actions={
        items.length > 0 ? (
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-1.5 h-4 w-4" />
            Exportar CSV
          </Button>
        ) : undefined
      }
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <KpiCard label="Itens a Repor" value={String(items.length)} icon={ShoppingCart} />
        <KpiCard label="Urgentes" value={String(urgenteCount)} icon={AlertCircle} variant={urgenteCount > 0 ? "danger" : "default"} />
        <KpiCard label="Prioridade Alta" value={String(altaCount)} icon={AlertTriangle} variant={altaCount > 0 ? "warning" : "default"} />
        <KpiCard label="Custo Estimado" value={eur(totalEstimate)} icon={Euro} accent />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input
          placeholder="Pesquisar ingrediente ou fornecedor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-full sm:w-72"
          aria-label="Pesquisar ingrediente"
        />
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue placeholder="Urgência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "none" | "supplier" | "urgency")}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue placeholder="Agrupar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem agrupamento</SelectItem>
            <SelectItem value="urgency">Por urgência</SelectItem>
            <SelectItem value="supplier">Por fornecedor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table or Empty */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={items.length === 0 ? "Nada para repor" : "Nenhum resultado"}
          description={
            items.length === 0
              ? "Todos os ingredientes estão acima do stock mínimo."
              : "Tente alterar os filtros."
          }
        />
      ) : (
        <ShoppingListTable
          items={filtered}
          groupBy={groupBy}
          orderedIds={orderedIds}
          onMarkOrdered={handleMarkOrdered}
        />
      )}
    </PageContainer>
  );
}
