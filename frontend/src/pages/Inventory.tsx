import { useState, useMemo } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { IngredientTable } from "@/components/inventory/IngredientTable";
import { StockEventList } from "@/components/inventory/StockEventList";
import { AddIngredientDialog } from "@/components/inventory/AddIngredientDialog";
import { AddStockEventDialog } from "@/components/inventory/AddStockEventDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Package, Plus, ArrowDownToLine, AlertTriangle,
  XCircle, TrendingUp, Loader2,
} from "lucide-react";
import {
  useIngredients,
  useStockEvents,
  useInventoryStats,
  useDeleteIngredient,
  useSuppliers,
} from "@/hooks/use-inventory";
import type { Ingredient } from "@/lib/api";

const eur = (v: number) => `€\u202f${v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Inventory() {
  const { data: ingredients = [], isLoading: loadingIng } = useIngredients();
  const { data: events = [], isLoading: loadingEv } = useStockEvents({ limit: 50 });
  const { data: stats } = useInventoryStats();
  const { data: suppliers = [] } = useSuppliers();
  const deleteIng = useDeleteIngredient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [stockEventDialog, setStockEventDialog] = useState<{
    open: boolean;
    ingredientId?: number;
    type?: string;
  }>({ open: false });

  const filtered = useMemo(() => {
    return ingredients.filter((ing) => {
      if (search) {
        const q = search.toLowerCase();
        if (!ing.name.toLowerCase().includes(q) && !ing.category.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== "all" && ing.status !== statusFilter) return false;
      return true;
    });
  }, [ingredients, search, statusFilter]);

  const isLoading = loadingIng || loadingEv;

  if (isLoading) {
    return (
      <PageContainer title="Inventário" subtitle="Gestão de stock de ingredientes">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-tim-gold" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Inventário"
      subtitle="Gestão de stock de ingredientes"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setStockEventDialog({ open: true })}>
            <ArrowDownToLine className="mr-1.5 h-4 w-4" />
            Registar Movimento
          </Button>
          <Button size="sm" onClick={() => setShowAddIngredient(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo Ingrediente
          </Button>
        </div>
      }
    >
      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 mb-6">
          <KpiCard label="Ingredientes" value={String(stats.total_ingredients)} icon={Package} />
          <KpiCard label="Valor em Stock" value={eur(stats.stock_value)} icon={TrendingUp} accent />
          <KpiCard label="Em Rutura" value={String(stats.rutura_count)} icon={XCircle} variant={stats.rutura_count > 0 ? "danger" : "default"} />
          <KpiCard label="Stock Baixo" value={String(stats.baixo_count)} icon={AlertTriangle} variant={stats.baixo_count > 0 ? "warning" : "default"} />
          <KpiCard label="Entradas (30d)" value={String(stats.recent_entradas)} compact />
          <KpiCard label="Saídas (30d)" value={String(stats.recent_saidas)} compact />
        </div>
      )}

      {/* Tabs: Ingredientes | Movimentos */}
      <Tabs defaultValue="ingredientes" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="ingredientes">Ingredientes</TabsTrigger>
            <TabsTrigger value="movimentos">Movimentos</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Pesquisar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-48"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="rutura">Rutura</SelectItem>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="excesso">Excesso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="ingredientes">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title={ingredients.length === 0 ? "Sem ingredientes" : "Nenhum resultado"}
              description={ingredients.length === 0 ? "Adicione o seu primeiro ingrediente para começar a gerir o stock." : "Tente alterar os filtros."}
              actionLabel={ingredients.length === 0 ? "Novo Ingrediente" : undefined}
              onAction={ingredients.length === 0 ? () => setShowAddIngredient(true) : undefined}
            />
          ) : (
            <IngredientTable
              ingredients={filtered}
              onAddStock={(ing) => setStockEventDialog({ open: true, ingredientId: ing.id, type: "entrada" })}
              onRemoveStock={(ing) => setStockEventDialog({ open: true, ingredientId: ing.id, type: "saída" })}
              onDelete={(id) => deleteIng.mutate(id)}
            />
          )}
        </TabsContent>

        <TabsContent value="movimentos">
          {events.length === 0 ? (
            <EmptyState
              icon={ArrowDownToLine}
              title="Sem movimentos"
              description="Os movimentos de stock aparecerão aqui à medida que registar entradas e saídas."
            />
          ) : (
            <StockEventList events={events} />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddIngredientDialog open={showAddIngredient} onOpenChange={setShowAddIngredient} suppliers={suppliers} />
      <AddStockEventDialog
        open={stockEventDialog.open}
        onOpenChange={(open) => setStockEventDialog((s) => ({ ...s, open }))}
        ingredients={ingredients}
        preselectedIngredientId={stockEventDialog.ingredientId}
        preselectedType={stockEventDialog.type}
      />
    </PageContainer>
  );
}
