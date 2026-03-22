import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useCreateProduct, useUpdateProduct, useIngredients } from "@/hooks/use-inventory";
import type { Product, RecipeIngredient, Ingredient } from "@/lib/api";

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProduct?: Product | null;
}

interface RecipeLine {
  _key: number;
  ingredient_id: number;
  qty: string;
  unit: string;
  wastage_percent: string;
}

const eur = (v: number) => `€\u202f${v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
let nextLineId = 1;

export function AddProductDialog({ open, onOpenChange, editProduct }: AddProductDialogProps) {
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const { data: allIngredients = [] } = useIngredients();
  const isEditing = !!editProduct;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [pvp, setPvp] = useState("");
  const [manualCost, setManualCost] = useState("");
  const [active, setActive] = useState(true);
  const [recipeLines, setRecipeLines] = useState<RecipeLine[]>([]);

  useEffect(() => {
    if (editProduct) {
      setCode(editProduct.code || "");
      setName(editProduct.name);
      setCategory(editProduct.category || "");
      setPvp(String(editProduct.pvp));
      setManualCost(editProduct.estimated_cost > 0 && editProduct.ingredients.length === 0 ? String(editProduct.estimated_cost) : "");
      setActive(editProduct.active);
      setRecipeLines(
        editProduct.ingredients.map((ri) => ({
          _key: nextLineId++,
          ingredient_id: ri.ingredient_id,
          qty: String(ri.qty),
          unit: ri.unit,
          wastage_percent: String(ri.wastage_percent),
        }))
      );
    } else {
      resetForm();
    }
  }, [editProduct, open]);

  const resetForm = () => {
    setCode("");
    setName("");
    setCategory("");
    setPvp("");
    setManualCost("");
    setActive(true);
    setRecipeLines([]);
  };

  const ingredientMap = useMemo(() => {
    const map = new Map<number, Ingredient>();
    allIngredients.forEach((i) => map.set(i.id, i));
    return map;
  }, [allIngredients]);

  const usedIds = useMemo(() => new Set(recipeLines.map((l) => l.ingredient_id)), [recipeLines]);
  const availableIngredients = useMemo(() => allIngredients.filter((i) => !usedIds.has(i.id)), [allIngredients, usedIds]);

  const estimatedCost = useMemo(() => {
    return recipeLines.reduce((sum, line) => {
      const ing = ingredientMap.get(line.ingredient_id);
      if (!ing) return sum;
      const qty = parseFloat(line.qty) || 0;
      const wastage = (parseFloat(line.wastage_percent) || 0) / 100;
      return sum + qty * (1 + wastage) * ing.avg_cost;
    }, 0);
  }, [recipeLines, ingredientMap]);

  const manualCostNum = parseFloat(manualCost) || 0;
  const effectiveCost = recipeLines.length > 0 ? estimatedCost : manualCostNum;
  const pvpNum = parseFloat(pvp) || 0;
  const margin = pvpNum > 0 ? (pvpNum - effectiveCost) / pvpNum : 0;

  const addLine = () => {
    if (availableIngredients.length === 0) return;
    const first = availableIngredients[0];
    setRecipeLines([...recipeLines, {
      _key: nextLineId++,
      ingredient_id: first.id,
      qty: "1",
      unit: first.unit,
      wastage_percent: "0",
    }]);
  };

  const updateLine = (idx: number, field: keyof RecipeLine, value: string | number) => {
    setRecipeLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "ingredient_id") {
        const ing = ingredientMap.get(Number(value));
        if (ing) next[idx].unit = ing.unit;
      }
      return next;
    });
  };

  const removeLine = (idx: number) => {
    setRecipeLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const ingredients: RecipeIngredient[] = recipeLines.map((l) => ({
      ingredient_id: l.ingredient_id,
      qty: parseFloat(l.qty) || 0,
      unit: l.unit,
      wastage_percent: parseFloat(l.wastage_percent) || 0,
    }));

    const payload: Record<string, unknown> = {
      code: code.trim() || undefined,
      name: name.trim(),
      category: category.trim() || undefined,
      pvp: pvpNum,
      active,
      ingredients,
    };
    if (recipeLines.length === 0 && manualCostNum > 0) {
      payload.estimated_cost = manualCostNum;
    }

    const onSuccess = () => {
      resetForm();
      onOpenChange(false);
    };

    if (isEditing) {
      update.mutate({ id: editProduct!.id, ...payload }, { onSuccess });
    } else {
      create.mutate(payload, { onSuccess });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* Basic fields */}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="prod-code">Código</Label>
              <Input id="prod-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="MAR-001" />
            </div>
            <div className="grid gap-1.5 col-span-2">
              <Label htmlFor="prod-name">Nome</Label>
              <Input id="prod-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Marmita de Frango" autoFocus />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="prod-category">Categoria</Label>
              <Input id="prod-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="marmitas" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prod-pvp">PVP (€)</Label>
              <Input id="prod-pvp" type="number" step="0.01" min="0" value={pvp} onChange={(e) => setPvp(e.target.value)} placeholder="8.50" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prod-cost">Custo (€)</Label>
              <Input
                id="prod-cost"
                type="number"
                step="0.01"
                min="0"
                value={recipeLines.length > 0 ? estimatedCost.toFixed(2) : manualCost}
                onChange={(e) => setManualCost(e.target.value)}
                disabled={recipeLines.length > 0}
                placeholder={recipeLines.length > 0 ? "Auto (receita)" : "0.00"}
                title={recipeLines.length > 0 ? "Custo calculado pela receita" : "Custo manual"}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-end gap-2 pb-0.5">
              <Switch id="prod-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="prod-active" className="cursor-pointer">{active ? "Ativo" : "Inativo"}</Label>
            </div>
          </div>

          {/* Recipe */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base">Receita</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={availableIngredients.length === 0}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Ingrediente
              </Button>
            </div>

            {recipeLines.length > 0 ? (
              <div className="rounded-lg border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingrediente</TableHead>
                      <TableHead className="w-24">Qtd</TableHead>
                      <TableHead className="w-20">Un.</TableHead>
                      <TableHead className="w-24">Desp. %</TableHead>
                      <TableHead className="text-right w-24">Custo</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipeLines.map((line, idx) => {
                      const ing = ingredientMap.get(line.ingredient_id);
                      const qty = parseFloat(line.qty) || 0;
                      const wastage = (parseFloat(line.wastage_percent) || 0) / 100;
                      const lineCost = ing ? qty * (1 + wastage) * ing.avg_cost : 0;

                      return (
                        <TableRow key={line._key}>
                          <TableCell>
                            <Select value={String(line.ingredient_id)} onValueChange={(v) => updateLine(idx, "ingredient_id", Number(v))}>
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {allIngredients
                                  .filter((i) => i.id === line.ingredient_id || !usedIds.has(i.id))
                                  .map((i) => (
                                    <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.qty}
                              onChange={(e) => updateLine(idx, "qty", e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{line.unit}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              value={line.wastage_percent}
                              onChange={(e) => updateLine(idx, "wastage_percent", e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{eur(lineCost)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeLine(idx)} aria-label="Remover ingrediente">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg bg-card">
                Adicione ingredientes para definir a receita.
              </p>
            )}

            {/* Cost summary */}
            {recipeLines.length > 0 && (
              <div className="flex items-center justify-end gap-6 text-sm pt-1">
                <span className="text-muted-foreground">
                  Custo estimado: <span className="font-mono font-medium text-foreground">{eur(effectiveCost)}</span>
                </span>
                {pvpNum > 0 && (
                  <span className="text-muted-foreground">
                    Margem: <span className={`font-mono font-medium ${margin >= 0.4 ? "text-emerald-600" : margin >= 0.2 ? "text-amber-600" : "text-red-600"}`}>
                      {Math.round(margin * 100)}%
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isPending}>
            {isPending ? (isEditing ? "A guardar…" : "A criar…") : (isEditing ? "Guardar" : "Criar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
