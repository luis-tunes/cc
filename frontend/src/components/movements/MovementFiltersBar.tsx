import { cn } from "@/lib/utils";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

export interface MovementFilters {
  search: string;
  classification: "all" | "classified" | "unclassified";
  reconciliation: "all" | "reconciled" | "unreconciled";
  type: "all" | "debito" | "credito";
  anomaly: "all" | "anomaly" | "duplicate";
  confidence: "all" | "high" | "medium" | "low";
}

interface MovementFiltersBarProps {
  filters: MovementFilters;
  onChange: (f: MovementFilters) => void;
  resultCount: number;
  className?: string;
}

export function MovementFiltersBar({
  filters,
  onChange,
  resultCount,
  className,
}: MovementFiltersBarProps) {
  const update = (patch: Partial<MovementFilters>) => onChange({ ...filters, ...patch });

  const hasActive =
    filters.search !== "" ||
    filters.classification !== "all" ||
    filters.reconciliation !== "all" ||
    filters.type !== "all" ||
    filters.anomaly !== "all" ||
    filters.confidence !== "all";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative max-w-xs flex-1">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar descrição, referência, entidade…"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="h-8 pl-8 text-xs"
        />
      </div>

      <Select value={filters.classification} onValueChange={(v) => update({ classification: v as any })}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Classificação</SelectItem>
          <SelectItem value="classified">Classificado</SelectItem>
          <SelectItem value="unclassified">Não classificado</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.reconciliation} onValueChange={(v) => update({ reconciliation: v as any })}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Reconciliação</SelectItem>
          <SelectItem value="reconciled">Reconciliado</SelectItem>
          <SelectItem value="unreconciled">Não reconciliado</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.type} onValueChange={(v) => update({ type: v as any })}>
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tipo</SelectItem>
          <SelectItem value="debito">Débito</SelectItem>
          <SelectItem value="credito">Crédito</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.confidence} onValueChange={(v) => update({ confidence: v as any })}>
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Confiança</SelectItem>
          <SelectItem value="high">Alta (&gt;80%)</SelectItem>
          <SelectItem value="medium">Média (50–80%)</SelectItem>
          <SelectItem value="low">Baixa (&lt;50%)</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.anomaly} onValueChange={(v) => update({ anomaly: v as any })}>
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alertas</SelectItem>
          <SelectItem value="anomaly">Anomalias</SelectItem>
          <SelectItem value="duplicate">Duplicados</SelectItem>
        </SelectContent>
      </Select>

      {hasActive && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() =>
            onChange({ search: "", classification: "all", reconciliation: "all", type: "all", anomaly: "all", confidence: "all" })
          }
        >
          <X className="mr-1 h-3 w-3" /> Limpar filtros
        </Button>
      )}

      <span className="ml-auto text-xs text-muted-foreground">
        {resultCount} movimentos
      </span>
    </div>
  );
}
