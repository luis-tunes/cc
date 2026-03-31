import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCreateSupplier, useUpdateSupplier } from "@/hooks/use-inventory";
import type { Supplier } from "@/lib/api";

function validateNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false;
  const weights = [9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += parseInt(nif[i]) * weights[i];
  const remainder = sum % 11;
  const check = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(nif[8]) === check;
}

interface FormValues {
  name: string;
  nif: string;
  category: string;
  deliveryDays: string;
  reliability: string;
}

interface AddSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSupplier?: Supplier | null;
}

export function AddSupplierDialog({ open, onOpenChange, editSupplier }: AddSupplierDialogProps) {
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const isEditing = !!editSupplier;

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: { name: "", nif: "", category: "", deliveryDays: "", reliability: "100" },
  });

  const nifValue = watch("nif");
  const nifError = useMemo(() => {
    if (!nifValue.trim()) return null;
    if (nifValue.length < 9) return null;
    return validateNif(nifValue) ? null : "NIF inválido (mod 11)";
  }, [nifValue]);

  useEffect(() => {
    if (editSupplier) {
      reset({
        name: editSupplier.name,
        nif: editSupplier.nif || "",
        category: editSupplier.category || "",
        deliveryDays: editSupplier.avg_delivery_days ? String(editSupplier.avg_delivery_days) : "",
        reliability: String(Math.round(editSupplier.reliability)),
      });
    } else {
      reset({ name: "", nif: "", category: "", deliveryDays: "", reliability: "100" });
    }
  }, [editSupplier, open, reset]);

  const onSubmit = (data: FormValues) => {
    if (nifError) return;
    const payload = {
      name: data.name.trim(),
      nif: data.nif.trim() || undefined,
      category: data.category.trim() || undefined,
      avg_delivery_days: data.deliveryDays ? parseInt(data.deliveryDays) : undefined,
      reliability: parseFloat(data.reliability) || 100,
    };

    const onSuccess = () => {
      reset();
      onOpenChange(false);
    };

    if (isEditing) {
      update.mutate({ id: editSupplier!.id, ...payload }, { onSuccess });
    } else {
      create.mutate(payload, { onSuccess });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="sup-name">Nome</Label>
            <Input
              id="sup-name"
              {...register("name", { required: "Nome é obrigatório" })}
              placeholder="Ex: Makro Portugal"
              autoFocus
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sup-nif">NIF</Label>
              <Input
                id="sup-nif"
                {...register("nif", {
                  onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 9); },
                })}
                placeholder="123456789"
                maxLength={9}
                className={nifError ? "border-destructive" : ""}
              />
              {nifError && <p className="text-xs text-destructive">{nifError}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sup-category">Categoria</Label>
              <Select value={watch("category")} onValueChange={(v) => setValue("category", v)}>
                <SelectTrigger id="sup-category"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="grossista">Grossista</SelectItem>
                  <SelectItem value="produtor">Produtor</SelectItem>
                  <SelectItem value="distribuidor">Distribuidor</SelectItem>
                  <SelectItem value="retalho">Retalho</SelectItem>
                  <SelectItem value="embalagens">Embalagens</SelectItem>
                  <SelectItem value="limpeza">Limpeza</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sup-delivery">Prazo Entrega (dias)</Label>
              <Input id="sup-delivery" type="number" min="0" {...register("deliveryDays")} placeholder="2" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sup-reliability">Fiabilidade (%)</Label>
              <Input id="sup-reliability" type="number" min="0" max="100" {...register("reliability")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!!nifError || isPending}>
              {isPending ? "A guardar…" : (isEditing ? "Guardar" : "Criar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
