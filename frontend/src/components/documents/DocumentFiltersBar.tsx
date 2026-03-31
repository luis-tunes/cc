import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { StatusType } from "@/components/shared/StatusBadge";
import type { DocumentType } from "@/lib/documents-data";
import { documentTypeLabels } from "@/lib/documents-data";

export interface DocumentFilters {
  search: string;
  status: StatusType | "all";
  documentType: DocumentType | "all";
  needsReview: boolean | null;
}

interface DocumentFiltersBarProps {
  filters: DocumentFilters;
  onChange: (f: DocumentFilters) => void;
  resultCount: number;
  className?: string;
}

export function DocumentFiltersBar({
  filters,
  onChange,
  resultCount,
  className,
}: DocumentFiltersBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (patch: Partial<DocumentFilters>) =>
    onChange({ ...filters, ...patch });

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.documentType !== "all" ||
    filters.needsReview !== null ||
    filters.search !== "";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, fornecedor, NIF…"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(v) => update({ status: v as any })}
        >
          <SelectTrigger className="h-8 w-32 text-xs sm:w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="importado">Importado</SelectItem>
            <SelectItem value="extraído">Extraído</SelectItem>
            <SelectItem value="classificado">Classificado</SelectItem>
            <SelectItem value="reconciliado">Reconciliado</SelectItem>
            <SelectItem value="revisto">Revisto</SelectItem>
            <SelectItem value="anomalia">Anomalia</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.documentType}
          onValueChange={(v) => update({ documentType: v as any })}
        >
          <SelectTrigger className="h-8 w-32 text-xs sm:w-36">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(documentTypeLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filters.needsReview ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() =>
            update({ needsReview: filters.needsReview === true ? null : true })
          }
        >
          Requer revisão
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() =>
              onChange({
                search: "",
                status: "all",
                documentType: "all",
                needsReview: null,
              })
            }
          >
            <X className="mr-1 h-3 w-3" />
            Limpar filtros
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {resultCount} {resultCount === 1 ? "documento" : "documentos"}
        </span>
      </div>
    </div>
  );
}
