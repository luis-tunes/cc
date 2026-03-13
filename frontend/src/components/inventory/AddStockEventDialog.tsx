import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCreateStockEvent } from "@/hooks/use-inventory";
import type { Ingredient } from "@/lib/api";

interface AddStockEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredients: Ingredient[];
  preselectedIngredientId?: number;
  preselectedType?: string;
}

export function AddStockEventDialog({
  open,
  onOpenChange,
  ingredients,
  preselectedIngredientId,
  preselectedType,
}: AddStockEventDialogProps) {
  const create = useCreateStockEvent();
  const [type, setType] = useState(preselectedType || "entrada");
  const [ingredientId, setIngredientId] = useState(preselectedIngredientId ? String(preselectedIngredientId) : "");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (open) {
      setType(preselectedType || "entrada");
      setIngredientId(preselectedIngredientId ? String(preselectedIngredientId) : "");
      setQty("");
      setCost("");
      setReference("");
    }
  }, [open, preselectedType, preselectedIngredientId]);

  const handleSubmit = () => {
    const qtyNum = parseFloat(qty);
    if (!ingredientId || !qty || !(qtyNum > 0)) return;
    const ing = ingredients.find((i) => i.id === parseInt(ingredientId));
    create.mutate(
      {
        type,
        ingredient_id: parseInt(ingredientId),
        qty: parseFloat(qty),
        unit: ing?.unit || "kg",
        source: "manual",
        reference,
        ...(cost ? { cost: parseFloat(cost) } : {}),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const typeLabels: Record<string, string> = {
    entrada: "Entrada",
    "saída": "Saída",
    "desperdício": "Desperdício",
    ajuste: "Ajuste",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registar Movimento de Stock</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(typeLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
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
                  <SelectItem key={i.id} value={String(i.id)}>{i.name} ({i.unit})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ev-qty">Quantidade</Label>
              <Input id="ev-qty" type="number" step="0.1" min="0.01" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" autoFocus />
            </div>
            {type === "entrada" && (
              <div className="grid gap-1.5">
                <Label htmlFor="ev-cost">Custo Unit. (€)</Label>
                <Input id="ev-cost" type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
              </div>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ev-ref">Referência</Label>
            <Input id="ev-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Fatura #123, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!ingredientId || !qty || create.isPending}>
            {create.isPending ? "A registar…" : "Registar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
