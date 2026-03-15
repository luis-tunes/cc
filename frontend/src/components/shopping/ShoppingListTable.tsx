import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { UrgencyBadge } from "./UrgencyBadge";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShoppingListItem } from "@/lib/api";

interface ShoppingListTableProps {
  items: ShoppingListItem[];
  groupBy: "none" | "supplier" | "urgency";
  orderedIds?: Set<number>;
  onMarkOrdered?: (item: ShoppingListItem) => void;
}

const fmt = (v: number) => v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = (v: number) => `€\u202f${fmt(v)}`;

export function ShoppingListTable({ items, groupBy, orderedIds, onMarkOrdered }: ShoppingListTableProps) {
  if (groupBy === "none") {
    return <ItemsTable items={items} orderedIds={orderedIds} onMarkOrdered={onMarkOrdered} />;
  }

  const groups = groupItems(items, groupBy);

  return (
    <div className="space-y-6">
      {groups.map(({ label, items: groupItems, subtotal }) => (
        <div key={label} className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-medium text-foreground">{label}</h3>
            <span className="text-xs text-muted-foreground font-mono">
              {groupItems.length} itens · ~{eur(subtotal)}
            </span>
          </div>
          <ItemsTable items={groupItems} orderedIds={orderedIds} onMarkOrdered={onMarkOrdered} />
        </div>
      ))}
    </div>
  );
}

function ItemsTable({ items, orderedIds, onMarkOrdered }: { items: ShoppingListItem[]; orderedIds?: Set<number>; onMarkOrdered?: (item: ShoppingListItem) => void }) {
  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ingrediente</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead className="text-right">Stock Atual</TableHead>
            <TableHead className="text-right">Mínimo</TableHead>
            <TableHead className="text-right">Qty Sugerida</TableHead>
            <TableHead className="text-right">Preço Médio</TableHead>
            <TableHead className="text-right">Estimativa</TableHead>
            <TableHead className="text-center">Urgência</TableHead>
            {onMarkOrdered && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const lineCost = item.suggested_qty * item.avg_price;
            const isOrdered = orderedIds?.has(item.ingredient_id);
            return (
              <TableRow key={item.ingredient_id} className={cn(isOrdered && "opacity-50")}>
                <TableCell className="font-medium">
                  {isOrdered && <CheckCircle2 className="inline mr-1.5 h-3.5 w-3.5 text-emerald-400" />}
                  {item.name}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.supplier_name || "—"}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {fmt(item.current_stock)} {item.unit}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {fmt(item.threshold)} {item.unit}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-medium">
                  {fmt(item.suggested_qty)} {item.unit}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{eur(item.avg_price)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{eur(lineCost)}</TableCell>
                <TableCell className="text-center">
                  <UrgencyBadge urgency={item.urgency} />
                </TableCell>
                {onMarkOrdered && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={isOrdered}
                      onClick={() => onMarkOrdered(item)}
                      title="Marcar como encomendado"
                    >
                      <CheckCircle2 className={cn("h-4 w-4", isOrdered ? "text-emerald-400" : "text-muted-foreground")} />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

interface Group {
  label: string;
  items: ShoppingListItem[];
  subtotal: number;
}

function groupItems(items: ShoppingListItem[], by: "supplier" | "urgency"): Group[] {
  const map = new Map<string, ShoppingListItem[]>();

  if (by === "urgency") {
    const order = ["urgente", "alta", "normal"];
    for (const u of order) map.set(u, []);
    for (const item of items) {
      const key = item.urgency;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    const labels: Record<string, string> = { urgente: "🔴 Urgente", alta: "🟠 Alta", normal: "🔵 Normal" };
    return Array.from(map.entries())
      .filter(([, items]) => items.length > 0)
      .map(([key, items]) => ({
        label: labels[key] || key,
        items,
        subtotal: items.reduce((s, i) => s + i.suggested_qty * i.avg_price, 0),
      }));
  }

  // by supplier
  for (const item of items) {
    const key = item.supplier_name || "Sem Fornecedor";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, items]) => ({
      label,
      items,
      subtotal: items.reduce((s, i) => s + i.suggested_qty * i.avg_price, 0),
    }));
}
