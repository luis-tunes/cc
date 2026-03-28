import { useState, useMemo } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
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
  XCircle, TrendingUp, Loader2, Wheat, Wrench,
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

const MATERIA_PRIMA_CATEGORIES = ["cereais", "legumes", "frutas", "carne", "peixe", "lacticínios", "gorduras", "temperos", "ovos", "leguminosas", "massas", "outros"];
const CONSUMIVEL_CATEGORIES = ["embalagem", "limpeza", "descartáveis", "higiene", "escritório", "consumível"];

function classifyCategory(cat: string): "materia-prima" | "consumivel" {
  const lower = cat.toLowerCase().trim();
  if (CONSUMIVEL_CATEGORIES.some((c) => lower.includes(c))) return "consumivel";
  return "materia-prima";
}

export default function Inventory() {
  const { data: ingredients = [], isLoading: loadingIng, isError, refetch } = useIngredients();
  const { data: events = [], isLoading: loadingEv } = useStockEvents({ limit: 50 });
  const { data: stats } = useInventoryStats();
  const { data: suppliers = [] } = useSuppliers();
  const deleteIng = useDeleteIngredient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [activeTab, setActiveTab] = useState("materias-primas");
  const [defaultCategory, setDefaultCategory] = useState("");
  const [stockEventDialog, setStockEventDialog] = useState<{
    open: boolean;
    ingredientId?: number;
    type?: string;
  }>({ open: false });

  const materiasPrimas = useMemo(
    () => ingredients.filter((i) => classifyCategory(i.category) === "materia-prima"),
    [ingredients]
  );
  const consumiveis = useMemo(
    () => ingredients.filter((i) => classifyCategory(i.category) === "consumivel"),
    [ingredients]
  );

  const filterList = (list: Ingredient[]) =>
    list.filter((ing) => {
      if (search) {
        const q = search.toLowerCase();
        if (!ing.name.toLowerCase().includes(q) && !ing.category.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== "all" && ing.status !== statusFilter) return false;
      return true;
    });

  const filteredMP = useMemo(() => filterList(materiasPrimas), [materiasPrimas, search, statusFilter]);
  const filteredCons = useMemo(() => filterList(consumiveis), [consumiveis, search, statusFilter]);

  const isLoading = loadingIng || loadingEv;

  const mpStats = useMemo(() => ({
    total: materiasPrimas.length,
    rutura: materiasPrimas.filter((i) => i.status === "rutura").length,
    baixo: materiasPrimas.filter((i) => i.status === "baixo").length,
    value: materiasPrimas.reduce((s, i) => s + i.stock * i.avg_cost, 0),
  }), [materiasPrimas]);

  const consStats = useMemo(() => ({
    total: consumiveis.length,
    rutura: consumiveis.filter((i) => i.status === "rutura").length,
    baixo: consumiveis.filter((i) => i.status === "baixo").length,
    value: consumiveis.reduce((s, i) => s + i.stock * i.avg_cost, 0),
  }), [consumiveis]);

  if (isLoading) {
    return (
      <PageContainer title="Inventário" subtitle="Gestão de stock">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-tim-gold" />
        </div>
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer title="Inventário" subtitle="Gestão de stock">
        <ErrorState onRetry={refetch} />
      </PageContainer>
    );
  }

  const isConsumiveis = activeTab === "consumiveis";
  const addLabel = isConsumiveis ? "Novo Consumível" : "Nova Matéria Prima";

  const handleAddItem = () => {
    setDefaultCategory(isConsumiveis ? "consumível" : "");
    setShowAddIngredient(true);
  };

  const renderIngredientSection = (list: Ingredient[], emptyLabel: string, emptyDesc: string, emptyTutorial: string) => (
    list.length === 0 ? (
      <EmptyState
        icon={Package}
        title={ingredients.length === 0 ? emptyLabel : "Nenhum resultado"}
        description={ingredients.length === 0 ? emptyDesc : "Tente alterar os filtros."}
        tutorial={ingredients.length === 0 ? emptyTutorial : undefined}
        actionLabel={ingredients.length === 0 ? addLabel : undefined}
        onAction={ingredients.length === 0 ? handleAddItem : undefined}
      />
    ) : (
      <IngredientTable
        ingredients={list}
        onAddStock={(ing) => setStockEventDialog({ open: true, ingredientId: ing.id, type: "entrada" })}
        onRemoveStock={(ing) => setStockEventDialog({ open: true, ingredientId: ing.id, type: "saída" })}
        onDelete={(id) => deleteIng.mutate(id)}
      />
    )
  );

  return (
    <PageContainer
      title="Inventário"
      subtitle="Matérias primas, consumíveis e movimentos de stock"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setStockEventDialog({ open: true })}>
            <ArrowDownToLine className="mr-1.5 h-4 w-4" />
            Registar Movimento
          </Button>
          <Button size="sm" onClick={handleAddItem}>
            <Plus className="mr-1.5 h-4 w-4" />
            {addLabel}
          </Button>
        </div>
      }
    >
      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 mb-6">
          <KpiCard label="Total Ingredientes" value={String(stats.total_ingredients)} icon={Package} />
          <KpiCard label="Valor em Stock" value={eur(stats.stock_value)} icon={TrendingUp} accent />
          <KpiCard label="Em Rutura" value={String(stats.rutura_count)} icon={XCircle} variant={stats.rutura_count > 0 ? "danger" : "default"} />
          <KpiCard label="Stock Baixo" value={String(stats.baixo_count)} icon={AlertTriangle} variant={stats.baixo_count > 0 ? "warning" : "default"} />
          <KpiCard label="Entradas (30d)" value={String(stats.recent_entradas)} compact />
          <KpiCard label="Saídas (30d)" value={String(stats.recent_saidas)} compact />
        </div>
      )}

      {/* Tabs: Matérias Primas | Consumíveis | Movimentos */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger value="materias-primas" className="gap-1.5">
              <Wheat className="h-3.5 w-3.5" />
              Matérias Primas
              {mpStats.total > 0 && <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-mono">{mpStats.total}</span>}
            </TabsTrigger>
            <TabsTrigger value="consumiveis" className="gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              Consumíveis
              {consStats.total > 0 && <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-mono">{consStats.total}</span>}
            </TabsTrigger>
            <TabsTrigger value="movimentos">Movimentos</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Pesquisar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-48"
              aria-label="Pesquisar ingredientes"
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

        <TabsContent value="materias-primas">
          {/* MP-specific KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            <KpiCard label="Matérias Primas" value={String(mpStats.total)} icon={Wheat} compact />
            <KpiCard label="Valor MP" value={eur(mpStats.value)} compact />
            <KpiCard label="Rutura" value={String(mpStats.rutura)} variant={mpStats.rutura > 0 ? "danger" : "default"} compact />
            <KpiCard label="Stock Baixo" value={String(mpStats.baixo)} variant={mpStats.baixo > 0 ? "warning" : "default"} compact />
          </div>
          {renderIngredientSection(
            filteredMP,
            "Sem matérias primas",
            "Adicione a sua primeira matéria prima para começar a gerir o stock.",
            "Matérias primas são os ingredientes usados na produção — cereais, carne, legumes, etc. Defina stocks mínimos para receber alertas automáticos."
          )}
        </TabsContent>

        <TabsContent value="consumiveis">
          {/* Consumables-specific KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            <KpiCard label="Consumíveis" value={String(consStats.total)} icon={Wrench} compact />
            <KpiCard label="Valor Cons." value={eur(consStats.value)} compact />
            <KpiCard label="Rutura" value={String(consStats.rutura)} variant={consStats.rutura > 0 ? "danger" : "default"} compact />
            <KpiCard label="Stock Baixo" value={String(consStats.baixo)} variant={consStats.baixo > 0 ? "warning" : "default"} compact />
          </div>
          {renderIngredientSection(
            filteredCons,
            "Sem consumíveis",
            "Adicione o seu primeiro consumível — embalagens, produtos de limpeza, descartáveis, etc.",
            "Consumíveis são materiais não alimentares usados na operação. Controle stock de embalagens, material de limpeza e outros."
          )}
        </TabsContent>

        <TabsContent value="movimentos">
          {events.length === 0 ? (
            <EmptyState
              icon={ArrowDownToLine}
              title="Sem movimentos"
              description="Os movimentos de stock aparecerão aqui à medida que registar entradas e saídas."
              tutorial="Cada vez que receber mercadoria ou usar ingredientes numa produção, o movimento fica registado aqui com data, quantidade e custo."
            />
          ) : (
            <StockEventList events={events} />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddIngredientDialog open={showAddIngredient} onOpenChange={setShowAddIngredient} suppliers={suppliers} defaultCategory={defaultCategory} />
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
