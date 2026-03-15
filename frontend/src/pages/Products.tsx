import { useState, useMemo } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductTable } from "@/components/products/ProductTable";
import { AddProductDialog } from "@/components/products/AddProductDialog";
import { ProduceDialog } from "@/components/products/ProduceDialog";
import { StockEventList } from "@/components/inventory/StockEventList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UtensilsCrossed, Plus, TrendingUp, ToggleRight, Loader2, History,
} from "lucide-react";
import { useProducts, useDeleteProduct, useStockEvents } from "@/hooks/use-inventory";
import type { Product } from "@/lib/api";

const eur = (v: number) => `€\u202f${v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Products() {
  const { data: products = [], isLoading } = useProducts();
  const deleteProd = useDeleteProduct();
  const { data: productionEvents = [] } = useStockEvents({ event_type: "saída", limit: 100 });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [produceProduct, setProduceProduct] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.code.toLowerCase().includes(q) &&
          !(p.category && p.category.toLowerCase().includes(q))
        ) return false;
      }
      if (statusFilter === "active" && !p.active) return false;
      if (statusFilter === "inactive" && p.active) return false;
      return true;
    });
  }, [products, search, statusFilter]);

  const activeCount = useMemo(() => products.filter((p) => p.active).length, [products]);

  const avgMargin = useMemo(() => {
    const active = products.filter((p) => p.active && p.pvp > 0);
    if (active.length === 0) return 0;
    return Math.round(
      (active.reduce((sum, p) => sum + p.margin, 0) / active.length) * 100
    );
  }, [products]);

  const avgCost = useMemo(() => {
    const active = products.filter((p) => p.active);
    if (active.length === 0) return 0;
    return active.reduce((sum, p) => sum + p.estimated_cost, 0) / active.length;
  }, [products]);

  // Filter production events (source contains "produ") for the production history tab
  const prodHistory = useMemo(
    () => productionEvents.filter((e) => e.source?.toLowerCase().includes("produ") || e.reference?.toLowerCase().includes("produ")),
    [productionEvents]
  );

  const handleEdit = (product: Product) => {
    setEditProduct(product);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditProduct(null);
  };

  if (isLoading) {
    return (
      <PageContainer title="Produto Acabado" subtitle="Produtos, receitas e custos">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-tim-gold" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Produto Acabado"
      subtitle="Produtos, receitas e custos"
      actions={
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Produto
        </Button>
      }
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <KpiCard label="Total Produtos" value={String(products.length)} icon={UtensilsCrossed} />
        <KpiCard label="Ativos" value={String(activeCount)} icon={ToggleRight} accent />
        <KpiCard label="Margem Média" value={`${avgMargin}%`} icon={TrendingUp} variant={avgMargin < 30 ? "warning" : "default"} />
        <KpiCard label="Custo Médio" value={eur(avgCost)} compact />
      </div>

      <Tabs defaultValue="produtos" className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="producoes" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              Histórico Produção
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Pesquisar produto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-64"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="produtos">
          {filtered.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title={products.length === 0 ? "Sem produtos" : "Nenhum resultado"}
              description={
                products.length === 0
                  ? "Adicione o seu primeiro produto para definir receitas e calcular custos."
                  : "Tente alterar os filtros."
              }
              actionLabel={products.length === 0 ? "Novo Produto" : undefined}
              onAction={products.length === 0 ? () => setDialogOpen(true) : undefined}
            />
          ) : (
            <ProductTable
              products={filtered}
              onEdit={handleEdit}
              onDelete={(id) => deleteProd.mutate(id)}
              onProduce={setProduceProduct}
            />
          )}
        </TabsContent>

        <TabsContent value="producoes">
          {prodHistory.length === 0 ? (
            <EmptyState
              icon={History}
              title="Sem produções"
              description="O histórico de produções aparecerá aqui quando produzir produtos."
            />
          ) : (
            <StockEventList events={prodHistory} />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddProductDialog open={dialogOpen} onOpenChange={handleDialogChange} editProduct={editProduct} />
      <ProduceDialog open={!!produceProduct} onOpenChange={(open) => { if (!open) setProduceProduct(null); }} product={produceProduct} />
    </PageContainer>
  );
}
