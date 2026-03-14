import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StockStatusBadge } from "./StockStatusBadge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, ArrowDownToLine, ArrowUpFromLine, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Ingredient } from "@/lib/api";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { cn } from "@/lib/utils";

interface IngredientTableProps {
  ingredients: Ingredient[];
  onAddStock: (ingredient: Ingredient) => void;
  onRemoveStock: (ingredient: Ingredient) => void;
  onDelete: (id: number) => void;
}

const fmt = (v: number) => v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function IngredientTable({ ingredients, onAddStock, onRemoveStock, onDelete }: IngredientTableProps) {
  const { focusedIndex, containerRef } = useKeyboardNav(ingredients.length);

  return (
    <div ref={containerRef} tabIndex={0} className="rounded-lg border bg-card overflow-x-auto outline-none">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ingrediente</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Custo Médio</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingredients.map((ing, idx) => (
            <TableRow key={ing.id} className={cn(focusedIndex === idx && "ring-1 ring-inset ring-primary/40 bg-primary/5")}>
              <TableCell className="font-medium">{ing.name}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{ing.category || "—"}</TableCell>
              <TableCell className="text-right font-mono text-sm">
                {fmt(ing.stock)} {ing.unit}
              </TableCell>
              <TableCell>
                <StockStatusBadge status={ing.status} />
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                €{fmt(ing.avg_cost)}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {ing.supplier_name || "—"}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ações">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onAddStock(ing)}>
                      <ArrowDownToLine className="mr-2 h-4 w-4" />
                      Entrada
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onRemoveStock(ing)}>
                      <ArrowUpFromLine className="mr-2 h-4 w-4" />
                      Saída
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm(`Remover "${ing.name}"?`)) onDelete(ing.id); }}>
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
  );
}
