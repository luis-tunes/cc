import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { StockEvent } from "@/lib/api";

const fmt = (v: number) => v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const typeConfig: Record<string, { label: string; className: string }> = {
  entrada: { label: "Entrada", className: "bg-tim-success/15 text-tim-success border-tim-success/30" },
  "saída": { label: "Saída", className: "bg-tim-danger/15 text-tim-danger border-tim-danger/30" },
  "desperdício": { label: "Desperdício", className: "bg-tim-warning/15 text-tim-warning border-tim-warning/30" },
  ajuste: { label: "Ajuste", className: "bg-tim-info/15 text-tim-info border-tim-info/30" },
};

interface StockEventListProps {
  events: StockEvent[];
}

export function StockEventList({ events }: StockEventListProps) {
  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Ingrediente</TableHead>
            <TableHead className="text-right">Qtd.</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Referência</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((ev) => {
            const tc = typeConfig[ev.type] || { label: ev.type, className: "" };
            return (
              <TableRow key={ev.id}>
                <TableCell className="text-sm text-muted-foreground">{ev.date}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={tc.className}>{tc.label}</Badge>
                </TableCell>
                <TableCell className="font-medium">{ev.ingredient_name}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {ev.type === "entrada" ? "+" : ev.type === "ajuste" ? (ev.qty >= 0 ? "+" : "") : "−"}{fmt(Math.abs(ev.qty))} {ev.unit}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{ev.source}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{ev.reference || "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
