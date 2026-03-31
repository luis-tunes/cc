import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfitLoss } from "@/hooks/use-accounting";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);

export default function ProfitLossPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = useProfitLoss({
    year: !dateFrom && !dateTo ? year : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const resultado = data?.resultado_liquido ?? 0;

  return (
    <PageContainer
      title="Demonstração de Resultados"
      subtitle="Receitas e gastos a partir dos lançamentos contabilísticos"
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-xs">Ano Fiscal</Label>
            <Input
              type="number"
              className="w-24"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || currentYear)}
            />
          </div>
          <div>
            <Label className="text-xs">Data Início</Label>
            <Input
              type="date"
              className="w-40"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Data Fim</Label>
            <Input
              type="date"
              className="w-40"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Rendimentos (Classe 7)
              </div>
              <div className="text-2xl font-bold text-green-600 mt-1">
                {fmt(data.total_rendimentos)}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Gastos (Classe 6)
              </div>
              <div className="text-2xl font-bold text-red-600 mt-1">
                {fmt(data.total_gastos)}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {resultado >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                Resultado Líquido
              </div>
              <div
                className={cn(
                  "text-2xl font-bold mt-1",
                  resultado >= 0 ? "text-green-600" : "text-red-600",
                )}
              >
                {fmt(resultado)}
              </div>
            </div>
          </div>
        )}

        {/* Revenue section */}
        {data && data.rendimentos.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Rendimentos
            </h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead>Designação</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rendimentos.map((r) => (
                    <TableRow key={r.code}>
                      <TableCell className="font-mono text-sm">{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right">{fmt(r.debit)}</TableCell>
                      <TableCell className="text-right">{fmt(r.credit)}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {fmt(r.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-green-50 dark:bg-green-900/10">
                    <TableCell colSpan={4}>Total Rendimentos</TableCell>
                    <TableCell className="text-right text-green-600">
                      {fmt(data.total_rendimentos)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Expenses section */}
        {data && data.gastos.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Gastos
            </h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead>Designação</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.gastos.map((r) => (
                    <TableRow key={r.code}>
                      <TableCell className="font-mono text-sm">{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right">{fmt(r.debit)}</TableCell>
                      <TableCell className="text-right">{fmt(r.credit)}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {fmt(r.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-red-50 dark:bg-red-900/10">
                    <TableCell colSpan={4}>Total Gastos</TableCell>
                    <TableCell className="text-right text-red-600">
                      {fmt(data.total_gastos)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Net result bar */}
        {data && (
          <div
            className={cn(
              "rounded-lg border-2 p-4 text-center",
              resultado >= 0
                ? "border-green-300 bg-green-50 dark:bg-green-900/10"
                : "border-red-300 bg-red-50 dark:bg-red-900/10",
            )}
          >
            <div className="text-sm text-muted-foreground mb-1">
              Resultado Líquido do Período
            </div>
            <div
              className={cn(
                "text-3xl font-bold",
                resultado >= 0 ? "text-green-600" : "text-red-600",
              )}
            >
              {fmt(resultado)}
            </div>
            <Badge
              className={cn(
                "mt-2",
                resultado > 0
                  ? "bg-green-100 text-green-800"
                  : resultado < 0
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-800",
              )}
            >
              {resultado > 0 ? "Lucro" : resultado < 0 ? "Prejuízo" : "Equilíbrio"}
            </Badge>
          </div>
        )}

        {/* Empty state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            A carregar...
          </div>
        )}
        {!isLoading && data && data.rendimentos.length === 0 && data.gastos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Minus className="h-12 w-12 mb-2" />
            <p>Sem lançamentos contabilísticos para o período selecionado.</p>
            <p className="text-sm">Crie lançamentos na página de Lançamentos para ver a Demonstração de Resultados.</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
