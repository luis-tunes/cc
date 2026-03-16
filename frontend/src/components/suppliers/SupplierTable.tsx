import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { Supplier } from "@/lib/api";
import { useState } from "react";

interface SupplierTableProps {
  suppliers: Supplier[];
  onEdit: (supplier: Supplier) => void;
  onDelete: (id: number) => void;
}

export function SupplierTable({ suppliers, onEdit, onDelete }: SupplierTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  return (
    <>
    <ConfirmDialog
      open={!!deleteTarget}
      onOpenChange={(open) => !open && setDeleteTarget(null)}
      title="Remover fornecedor"
      description={`Tem a certeza que quer remover "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
      confirmLabel="Remover"
      onConfirm={() => { if (deleteTarget) { onDelete(deleteTarget.id); setDeleteTarget(null); } }}
    />
    <div className="rounded-lg border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>NIF</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Prazo Entrega</TableHead>
            <TableHead className="text-right">Fiabilidade</TableHead>
            <TableHead className="text-right">Ingredientes</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">{s.nif || "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.category || "—"}</TableCell>
              <TableCell className="text-right text-sm">
                {s.avg_delivery_days ? `${s.avg_delivery_days} dias` : "—"}
              </TableCell>
              <TableCell className="text-right">
                <ReliabilityBadge value={s.reliability} />
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {s.ingredient_ids.length}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ações">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(s)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(s)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </>
  );
}

function ReliabilityBadge({ value }: { value: number }) {
  const pct = Math.round(value);
  const color =
    pct >= 90 ? "text-emerald-600" :
    pct >= 70 ? "text-amber-600" :
    "text-red-600";
  return <span className={`text-sm font-mono ${color}`}>{pct}%</span>;
}
