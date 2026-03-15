import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCreateIngredient } from "@/hooks/use-inventory";
import type { Supplier } from "@/lib/api";

interface AddIngredientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
  defaultCategory?: string;
}

export function AddIngredientDialog({ open, onOpenChange, suppliers, defaultCategory }: AddIngredientDialogProps) {
  const create = useCreateIngredient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("kg");
  const [minThreshold, setMinThreshold] = useState("0");
  const [supplierId, setSupplierId] = useState<string>("");
  const [avgCost, setAvgCost] = useState("0");

  const handleSubmit = () => {
    if (!name.trim()) return;
    create.mutate(
      {
        name: name.trim(),
        category,
        unit,
        min_threshold: parseFloat(minThreshold) || 0,
        supplier_id: supplierId ? parseInt(supplierId) : null,
        avg_cost: parseFloat(avgCost) || 0,
        last_cost: parseFloat(avgCost) || 0,
      },
      {
        onSuccess: () => {
          setName("");
          setCategory("");
          setUnit("kg");
          setMinThreshold("0");
          setSupplierId("");
          setAvgCost("0");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Ingrediente</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ing-name">Nome</Label>
            <Input id="ing-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Arroz Carolino" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ing-category">Categoria</Label>
              <Select value={category || defaultCategory || ""} onValueChange={setCategory}>
                <SelectTrigger id="ing-category"><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cereais">Cereais</SelectItem>
                  <SelectItem value="legumes">Legumes</SelectItem>
                  <SelectItem value="frutas">Frutas</SelectItem>
                  <SelectItem value="carne">Carne</SelectItem>
                  <SelectItem value="peixe">Peixe</SelectItem>
                  <SelectItem value="lacticínios">Lacticínios</SelectItem>
                  <SelectItem value="gorduras">Gorduras</SelectItem>
                  <SelectItem value="temperos">Temperos</SelectItem>
                  <SelectItem value="ovos">Ovos</SelectItem>
                  <SelectItem value="leguminosas">Leguminosas</SelectItem>
                  <SelectItem value="massas">Massas</SelectItem>
                  <SelectItem value="embalagem">Embalagem</SelectItem>
                  <SelectItem value="limpeza">Limpeza</SelectItem>
                  <SelectItem value="descartáveis">Descartáveis</SelectItem>
                  <SelectItem value="higiene">Higiene</SelectItem>
                  <SelectItem value="consumível">Consumível</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ing-unit">Unidade</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger id="ing-unit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="mL">mL</SelectItem>
                  <SelectItem value="un">un</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ing-threshold">Stock Mínimo</Label>
              <Input id="ing-threshold" type="number" step="0.1" min="0" value={minThreshold} onChange={(e) => setMinThreshold(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ing-cost">Custo Médio (€)</Label>
              <Input id="ing-cost" type="number" step="0.01" min="0" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} />
            </div>
          </div>
          {suppliers.length > 0 && (
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
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || create.isPending}>
            {create.isPending ? "A criar…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
