import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, Book } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccounts, useGeneralLedger } from "@/hooks/use-accounting";

function fmt(v: string) {
  const n = parseFloat(v);
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
}

export default function GeneralLedger() {
  const [accountCode, setAccountCode] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: accounts } = useAccounts();
  const { data: rows, isLoading, error } = useGeneralLedger(
    accountCode || null,
    dateFrom || undefined,
    dateTo || undefined,
  );

  const selectedAccount = (accounts ?? []).find((a) => a.code === accountCode);

  if (error) return <PageContainer title="Razão"><ErrorState title="Erro ao carregar razão" /></PageContainer>;

  return (
    <PageContainer
      title="Razão"
      subtitle="Razão geral — extrato detalhado por conta"
    >
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        <Select value={accountCode} onValueChange={setAccountCode}>
          <SelectTrigger className="w-[320px]">
            <SelectValue placeholder="Selecionar conta..." />
          </SelectTrigger>
          <SelectContent>
            {(accounts ?? []).map((a) => (
              <SelectItem key={a.code} value={a.code}>
                <span className="font-mono">{a.code}</span> — {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">De:</span>
          <Input type="date" className="w-[160px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Até:</span>
          <Input type="date" className="w-[160px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {!accountCode ? (
        <EmptyState
          icon={Book}
          title="Selecione uma conta"
          description="Escolha uma conta do plano de contas para ver o extrato detalhado."
        />
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-tim-gold" />
        </div>
      ) : (!rows || rows.length === 0) ? (
        <EmptyState
          icon={Book}
          title="Sem movimentos"
          description={`A conta ${accountCode} — ${selectedAccount?.name ?? ""} não tem movimentos no período selecionado.`}
        />
      ) : (
        <>
          {selectedAccount && (
            <div className="mb-4 rounded-lg border bg-muted/50 p-4">
              <h3 className="text-lg font-semibold">
                <span className="font-mono">{selectedAccount.code}</span> — {selectedAccount.name}
              </h3>
            </div>
          )}
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead className="w-[80px]">Diário</TableHead>
                  <TableHead className="w-[120px]">Referência</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[130px] text-right">Débito</TableHead>
                  <TableHead className="w-[130px] text-right">Crédito</TableHead>
                  <TableHead className="w-[140px] text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const bal = parseFloat(row.balance);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">{row.entry_date}</TableCell>
                      <TableCell className="font-mono text-xs">{row.journal_code}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.reference || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {row.line_description || row.entry_description || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {parseFloat(row.debit) > 0 ? fmt(row.debit) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {parseFloat(row.credit) > 0 ? fmt(row.credit) : ""}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-mono text-sm font-medium",
                        bal > 0 ? "text-tim-success" : bal < 0 ? "text-tim-danger" : "",
                      )}>
                        {fmt(row.balance)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </PageContainer>
  );
}
