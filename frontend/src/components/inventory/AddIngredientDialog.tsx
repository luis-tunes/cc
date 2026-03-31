import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCreateIngredient } from "@/hooks/use-inventory";
import type { Supplier } from "@/lib/api";

const MP_CATEGORIES = [
  { value: "cereais", label: "Cereais" },
  { value: "legumes", label: "Legumes" },
  { value: "frutas", label: "Frutas" },
  { value: "carne", label: "Carne" },
  { value: "peixe", label: "Peixe" },
  { value: "lacticínios", label: "Lacticínios" },
  { value: "gorduras", label: "Gorduras" },
  { value: "temperos", label: "Temperos" },
  { value: "ovos", label: "Ovos" },
  { value: "leguminosas", label: "Leguminosas" },
  { value: "massas", label: "Massas" },
  { value: "outros", label: "Outros" },
];

const CONS_CATEGORIES = [
  { value: "embalagem", label: "Embalagem" },
  { value: "limpeza", label: "Limpeza" },
  { value: "descartáveis", label: "Descartáveis" },
  { value: "higiene", label: "Higiene" },
  { value: "escritório", label: "Escritório" },
  { value: "consumível", label: "Consumível" },
];

interface FormValues {
  name: string;
  category: string;
  unit: string;
  minThreshold: string;
  supplierId: string;
  avgCost: string;
}

interface AddIngredientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
  defaultCategory?: string;
}

export function AddIngredientDialog({ open, onOpenChange, suppliers, defaultCategory }: AddIngredientDialogProps) {
  const create = useCreateIngredient();

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: { name: "", category: "", unit: "kg", minThreshold: "0", supplierId: "", avgCost: "0" },
  });

  const category = watch("category");
  const isConsumivel = CONS_CATEGORIES.some((c) => c.value === (category || defaultCategory));
  const dialogTitle = isConsumivel ? "Novo Consumível" : "Nova Matéria Prima";

  useEffect(() => {
    if (open) {
      reset({ name: "", category: defaultCategory || "", unit: "kg", minThreshold: "0", supplierId: "", avgCost: "0" });
    }
  }, [open, defaultCategory, reset]);

  const onSubmit = (data: FormValues) => {
    create.mutate(
      {
        name: data.name.trim(),
        category: data.category,
        unit: data.unit,
        min_threshold: parseFloat(data.minThreshold) || 0,
        supplier_id: data.supplierId ? parseInt(data.supplierId) : null,
        avg_cost: parseFloat(data.avgCost) || 0,
        last_cost: parseFloat(data.avgCost) || 0,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ing-name">Nome</Label>
            <Input
              id="ing-name"
              {...register("name", { required: "Nome é obrigatório" })}
              placeholder={isConsumivel ? "Ex: Caixa Take-Away 500ml" : "Ex: Arroz Carolino"}
              autoFocus
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ing-category">Categoria</Label>
              <Select value={category} onValueChange={(v) => setValue("category", v)}>
                <SelectTrigger id="ing-category"><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                <SelectContent>
                  {isConsumivel ? (
                    <SelectGroup>
                      <SelectLabel>Consumíveis</SelectLabel>
                      {CONS_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  ) : (
                    <SelectGroup>
                      <SelectLabel>Matérias Primas</SelectLabel>
                      {MP_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ing-unit">Unidade</Label>
              <Select value={watch("unit")} onValueChange={(v) => setValue("unit", v)}>
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
              <Input id="ing-threshold" type="number" step="0.1" min="0" {...register("minThreshold")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ing-cost">Custo Médio (€)</Label>
              <Input id="ing-cost" type="number" step="0.01" min="0" {...register("avgCost")} />
            </div>
          </div>
          {suppliers.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Fornecedor</Label>
              <Select value={watch("supplierId")} onValueChange={(v) => setValue("supplierId", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar fornecedor" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "A criar…" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
