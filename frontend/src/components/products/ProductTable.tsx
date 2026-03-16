import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Pencil, Trash2, Play } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { Product } from "@/lib/api";
import { useState } from "react";

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
  onProduce: (product: Product) => void;
}

const eur = (v: number) => `€\u202f${v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ProductTable({ products, onEdit, onDelete, onProduce }: ProductTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  return (
    <>
    <ConfirmDialog
      open={!!deleteTarget}
      onOpenChange={(open) => !open && setDeleteTarget(null)}
      title="Remover produto"
      description={`Tem a certeza que quer remover "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
      confirmLabel="Remover"
      onConfirm={() => { if (deleteTarget) { onDelete(deleteTarget.id); setDeleteTarget(null); } }}
    />
    <div className="rounded-lg border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Custo</TableHead>
            <TableHead className="text-right">PVP</TableHead>
            <TableHead className="text-right">Margem</TableHead>
            <TableHead className="text-center">Ingredientes</TableHead>
            <TableHead className="text-center">Estado</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-sm text-muted-foreground">{p.code || "—"}</TableCell>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.category || "—"}</TableCell>
              <TableCell className="text-right font-mono text-sm">{eur(p.estimated_cost)}</TableCell>
              <TableCell className="text-right font-mono text-sm">{eur(p.pvp)}</TableCell>
              <TableCell className="text-right">
                <MarginBadge margin={p.margin} />
              </TableCell>
              <TableCell className="text-center font-mono text-sm">{p.ingredients.length}</TableCell>
              <TableCell className="text-center">
                <Badge variant={p.active ? "default" : "secondary"} className={p.active ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>
                  {p.active ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ações">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onProduce(p)} disabled={!p.active}>
                      <Play className="mr-2 h-4 w-4" />
                      Produzir
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(p)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(p)}>
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

function MarginBadge({ margin }: { margin: number }) {
  const pct = Math.round(margin * 100);
  const color =
    pct >= 60 ? "text-emerald-600" :
    pct >= 40 ? "text-amber-600" :
    pct >= 20 ? "text-orange-600" :
    "text-red-600";
  return <span className={`text-sm font-mono ${color}`}>{pct}%</span>;
}
