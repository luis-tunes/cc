import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Plus, TrendingUp } from "lucide-react";
import { useIngredients, useAddPricePoint } from "@/hooks/use-inventory";
import type { Supplier, PricePoint } from "@/lib/api";

const eur = (v: number) => `€\u202f${v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  suppliers: Supplier[];
}

export function PriceHistoryPanel({ suppliers }: Props) {
  const { data: ingredients = [] } = useIngredients();
  const addPrice = useAddPricePoint();
  const [showAdd, setShowAdd] = useState(false);
  const [filterSupplier, setFilterSupplier] = useState("all");

  const allPrices = useMemo(() => {
    const entries: (PricePoint & { supplier_name: string; ingredient_name?: string })[] = [];
    for (const s of suppliers) {
      if (filterSupplier !== "all" && String(s.id) !== filterSupplier) continue;
      for (const p of s.price_history ?? []) {
        const ing = ingredients.find((i) => i.id === p.ingredient_id);
        entries.push({
          ...p,
          supplier_name: s.name,
          ingredient_name: ing?.name,
        });
      }
    }
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [suppliers, ingredients, filterSupplier]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={filterSupplier} onValueChange={setFilterSupplier}>
            <SelectTrigger className="h-8 w-48">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fornecedores</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Registar Preço
        </Button>
      </div>

      {allPrices.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Sem historial de preços"
          description="Registe preços de ingredientes junto dos fornecedores para acompanhar a evolução."
          actionLabel="Registar Preço"
          onAction={() => setShowAdd(true)}
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Ingrediente</TableHead>
                <TableHead className="text-right">Preço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allPrices.map((p, idx) => (
                <TableRow key={`${p.supplier_id}-${p.ingredient_id}-${p.date}-${idx}`}>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(p.date).toLocaleDateString("pt-PT")}
                  </TableCell>
                  <TableCell className="font-medium">{p.supplier_name}</TableCell>
                  <TableCell className="text-sm">{p.ingredient_name || `#${p.ingredient_id}`}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{eur(p.price)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddPriceDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        suppliers={suppliers}
        ingredients={ingredients}
        onSubmit={(data) => {
          addPrice.mutate(data, { onSuccess: () => setShowAdd(false) });
        }}
        isPending={addPrice.isPending}
      />
    </div>
  );
}

function AddPriceDialog({
  open,
  onOpenChange,
  suppliers,
  ingredients,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
  ingredients: { id: number; name: string }[];
  onSubmit: (data: PricePoint) => void;
  isPending: boolean;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  const handleSubmit = () => {
    if (!supplierId || !ingredientId || !price) return;
    onSubmit({
      supplier_id: parseInt(supplierId),
      ingredient_id: parseInt(ingredientId),
      price: parseFloat(price),
      date,
    });
    setSupplierId("");
    setIngredientId("");
    setPrice("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registar Preço</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Fornecedor</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Selecionar fornecedor" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Ingrediente</Label>
            <Select value={ingredientId} onValueChange={setIngredientId}>
              <SelectTrigger><SelectValue placeholder="Selecionar ingrediente" /></SelectTrigger>
              <SelectContent>
                {ingredients.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Preço (€)</Label>
              <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="grid gap-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!supplierId || !ingredientId || !price || isPending}>
            {isPending ? "A guardar…" : "Registar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
