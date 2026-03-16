import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useProduceProduct, useStockImpact } from "@/hooks/use-inventory";
import type { Product } from "@/lib/api";

interface ProduceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export function ProduceDialog({ open, onOpenChange, product }: ProduceDialogProps) {
  const produce = useProduceProduct();
  const [qty, setQty] = useState("1");
  const qtyNum = parseInt(qty) || 0;
  const { data: impact } = useStockImpact(product?.id ?? 0, qtyNum);

  const handleSubmit = () => {
    if (!product || qtyNum <= 0) return;
    produce.mutate(
      { id: product.id, qty: qtyNum },
      {
        onSuccess: () => {
          setQty("1");
          onOpenChange(false);
        },
      }
    );
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Produzir — {product.name}</DialogTitle>
          <DialogDescription>
            Vai descontar ingredientes do stock automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="produce-qty">Quantidade</Label>
            <Input
              id="produce-qty"
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
          </div>

          {/* Stock impact preview */}
          {impact && impact.impact.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Impacto no Stock</Label>
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingrediente</TableHead>
                      <TableHead className="text-right">Atual</TableHead>
                      <TableHead className="text-right">Necessário</TableHead>
                      <TableHead className="text-right">Depois</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {impact.impact.map((item) => (
                      <TableRow key={item.ingredient_id}>
                        <TableCell className="text-sm">{item.name}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmt(item.current_stock)} {item.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmt(item.needed)} {item.unit}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm ${!item.sufficient ? "text-red-600" : ""}`}>
                          {fmt(item.after)} {item.unit}
                        </TableCell>
                        <TableCell>
                          {item.sufficient ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {!impact.sufficient && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Stock insuficiente para alguns ingredientes.
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={qtyNum <= 0 || produce.isPending || (impact != null && !impact.sufficient)}>
            {produce.isPending ? "A produzir…" : `Produzir ${qtyNum}×`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const fmt = (v: number) => v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
