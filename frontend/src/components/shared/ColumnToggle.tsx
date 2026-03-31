import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SlidersHorizontal } from "lucide-react";

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
}

interface ColumnToggleProps {
  columns: ColumnConfig[];
  onChange: (key: string, visible: boolean) => void;
}

export function ColumnToggle({ columns, onChange }: ColumnToggleProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Colunas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">Colunas visíveis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={col.visible}
            onCheckedChange={(checked) => onChange(col.key, !!checked)}
            className="text-xs"
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
