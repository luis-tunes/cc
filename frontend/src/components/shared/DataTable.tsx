import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown } from "lucide-react";
import { EmptyState } from "./EmptyState";

export interface DataColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  data: T[];
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  emptyTitle = "Nenhum registo encontrado",
  emptyDescription = "Ajuste os filtros ou adicione novos dados.",
  className,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "text-xs font-medium uppercase tracking-wider text-muted-foreground",
                  col.className
                )}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                  )}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, idx) => (
            <TableRow
              key={idx}
              className="border-border transition-colors hover:bg-accent/50"
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={cn("text-sm", col.className)}>
                  {col.render
                    ? col.render(item)
                    : String(item[col.key] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
