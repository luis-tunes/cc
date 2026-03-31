import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Calculator, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTrialBalance } from "@/hooks/use-accounting";

function fmt(v: string) {
  const n = parseFloat(v);
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
}

const TYPE_LABELS: Record<string, string> = {
  asset: "Ativo",
  liability: "Passivo",
  equity: "Capital Próprio",
  revenue: "Rendimentos",
  expense: "Gastos",
};

export default function TrialBalance() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, error } = useTrialBalance(
    dateFrom || undefined,
    dateTo || undefined,
  );

  if (error) return <PageContainer title="Balancete"><ErrorState title="Erro ao carregar balancete" /></PageContainer>;

  return (
    <PageContainer
      title="Balancete"
      subtitle="Balancete de verificação — saldos por conta"
    >
      {/* Date filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">De:</span>
          <Input type="date" className="w-[160px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Até:</span>
          <Input type="date" className="w-[160px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {data && (
          <div className="ml-auto flex items-center gap-2">
            {data.balanced ? (
              <Badge variant="outline" className="bg-tim-success/15 text-tim-success border-tim-success/30 gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Balanceado
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-tim-danger/15 text-tim-danger border-tim-danger/30">
                Não balanceado
              </Badge>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-tim-gold" />
        </div>
      ) : (!data || data.rows.length === 0) ? (
        <EmptyState
          icon={Calculator}
          title="Sem dados no balancete"
          description="Crie lançamentos contabilísticos para ver o balancete de verificação."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[120px]">Tipo</TableHead>
                <TableHead className="w-[140px] text-right">Total Débito</TableHead>
                <TableHead className="w-[140px] text-right">Total Crédito</TableHead>
                <TableHead className="w-[140px] text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => {
                const balance = parseFloat(row.balance);
                return (
                  <TableRow key={row.code}>
                    <TableCell className="font-mono text-sm font-medium">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {TYPE_LABELS[row.type] ?? row.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {parseFloat(row.total_debit) > 0 ? fmt(row.total_debit) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {parseFloat(row.total_credit) > 0 ? fmt(row.total_credit) : "—"}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-mono text-sm font-medium",
                      balance > 0 ? "text-tim-success" : balance < 0 ? "text-tim-danger" : "",
                    )}>
                      {fmt(row.balance)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals row */}
              <TableRow className="bg-muted/50 font-bold border-t-2">
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right font-mono">{fmt(data.total_debit)}</TableCell>
                <TableCell className="text-right font-mono">{fmt(data.total_credit)}</TableCell>
                <TableCell className="text-right font-mono">—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </PageContainer>
  );
}
