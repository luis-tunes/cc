import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCreateSupplier, useUpdateSupplier } from "@/hooks/use-inventory";
import type { Supplier } from "@/lib/api";

interface AddSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSupplier?: Supplier | null;
}

export function AddSupplierDialog({ open, onOpenChange, editSupplier }: AddSupplierDialogProps) {
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const isEditing = !!editSupplier;

  const [name, setName] = useState("");
  const [nif, setNif] = useState("");
  const [category, setCategory] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [reliability, setReliability] = useState("100");

  useEffect(() => {
    if (editSupplier) {
      setName(editSupplier.name);
      setNif(editSupplier.nif || "");
      setCategory(editSupplier.category || "");
      setDeliveryDays(editSupplier.avg_delivery_days ? String(editSupplier.avg_delivery_days) : "");
      setReliability(String(Math.round(editSupplier.reliability)));
    } else {
      resetForm();
    }
  }, [editSupplier, open]);

  const resetForm = () => {
    setName("");
    setNif("");
    setCategory("");
    setDeliveryDays("");
    setReliability("100");
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      nif: nif.trim() || undefined,
      category: category.trim() || undefined,
      avg_delivery_days: deliveryDays ? parseInt(deliveryDays) : undefined,
      reliability: parseFloat(reliability) || 100,
    };

    const onSuccess = () => {
      resetForm();
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
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="sup-name">Nome</Label>
            <Input id="sup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Makro Portugal" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sup-nif">NIF</Label>
              <Input id="sup-nif" value={nif} onChange={(e) => setNif(e.target.value)} placeholder="123456789" maxLength={9} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sup-category">Categoria</Label>
              <Input id="sup-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="grossista" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sup-delivery">Prazo Entrega (dias)</Label>
              <Input id="sup-delivery" type="number" min="0" value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} placeholder="2" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sup-reliability">Fiabilidade (%)</Label>
              <Input id="sup-reliability" type="number" min="0" max="100" value={reliability} onChange={(e) => setReliability(e.target.value)} />
            </div>
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
