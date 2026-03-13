import { useState, useMemo } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { SupplierTable } from "@/components/suppliers/SupplierTable";
import { AddSupplierDialog } from "@/components/suppliers/AddSupplierDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Truck, Plus, Users, Clock, ShieldCheck, Loader2,
} from "lucide-react";
import { useSuppliers, useDeleteSupplier } from "@/hooks/use-inventory";
import type { Supplier } from "@/lib/api";

export default function Suppliers() {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const deleteSup = useDeleteSupplier();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

  const filtered = useMemo(() => {
    if (!search) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.nif && s.nif.includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q))
    );
  }, [suppliers, search]);

  const avgReliability = useMemo(() => {
    if (suppliers.length === 0) return 0;
    return Math.round(
      suppliers.reduce((sum, s) => sum + s.reliability, 0) / suppliers.length
    );
  }, [suppliers]);

  const avgDelivery = useMemo(() => {
    const withDays = suppliers.filter((s) => s.avg_delivery_days > 0);
    if (withDays.length === 0) return 0;
    return Math.round(
      withDays.reduce((sum, s) => sum + s.avg_delivery_days, 0) / withDays.length
    );
  }, [suppliers]);

  const totalIngredients = useMemo(() => {
    const ids = new Set(suppliers.flatMap((s) => s.ingredient_ids));
    return ids.size;
  }, [suppliers]);

  const handleEdit = (supplier: Supplier) => {
    setEditSupplier(supplier);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditSupplier(null);
  };

  if (isLoading) {
    return (
      <PageContainer title="Fornecedores" subtitle="Gestão de fornecedores e preços">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-tim-gold" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Fornecedores"
      subtitle="Gestão de fornecedores e preços"
      actions={
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Fornecedor
        </Button>
      }
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <KpiCard label="Fornecedores" value={String(suppliers.length)} icon={Users} />
        <KpiCard label="Fiabilidade Média" value={`${avgReliability}%`} icon={ShieldCheck} accent />
        <KpiCard label="Prazo Médio" value={avgDelivery ? `${avgDelivery} dias` : "—"} icon={Clock} />
        <KpiCard label="Ingredientes Cobertos" value={String(totalIngredients)} icon={Truck} />
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <Input
          placeholder="Pesquisar fornecedor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-64"
        />
      </div>

      {/* Table or Empty */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={suppliers.length === 0 ? "Sem fornecedores" : "Nenhum resultado"}
          description={
            suppliers.length === 0
              ? "Adicione o seu primeiro fornecedor para começar a gerir preços e entregas."
              : "Tente alterar a pesquisa."
          }
          actionLabel={suppliers.length === 0 ? "Novo Fornecedor" : undefined}
          onAction={suppliers.length === 0 ? () => setDialogOpen(true) : undefined}
        />
      ) : (
        <SupplierTable
          suppliers={filtered}
          onEdit={handleEdit}
          onDelete={(id) => deleteSup.mutate(id)}
        />
      )}

      {/* Dialog */}
      <AddSupplierDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        editSupplier={editSupplier}
      />
    </PageContainer>
  );
}
