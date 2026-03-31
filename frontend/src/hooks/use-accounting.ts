import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  seedAccounting,
  fetchAccounts,
  createAccount,
  patchAccount,
  fetchFiscalPeriods,
  createFiscalPeriod,
  closeFiscalPeriod,
  fetchAccountingJournals,
  fetchJournalEntries,
  fetchJournalEntry,
  createJournalEntry,
  generateEntryFromDocument,
  generateEntryFromBankTx,
  fetchTrialBalance,
  fetchGeneralLedger,
  fetchBalanceSheet,
  fetchProfitLoss,
  type Account,
  type FiscalPeriod,
  type AccountingJournal,
  type JournalEntry,
  type JournalEntryCreate,
  type TrialBalanceReport,
  type GeneralLedgerRow,
  type BalanceSheetReport,
  type ProfitLossReport,
} from "@/lib/api";
import { toast } from "sonner";

export type { Account, FiscalPeriod, AccountingJournal, JournalEntry, TrialBalanceReport, GeneralLedgerRow, BalanceSheetReport, ProfitLossReport };

export function useAccounts(type?: string, activeOnly = true) {
  return useQuery<Account[]>({
    queryKey: ["accounts", type, activeOnly],
    queryFn: () => fetchAccounts(type, activeOnly),
  });
}

export function useSeedAccounting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: seedAccounting,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["accounting-journals"] });
      toast.success(`Plano de contas inicializado: ${data.accounts_seeded} contas, ${data.journals_seeded} diários`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta criada");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function usePatchAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; active?: boolean } }) =>
      patchAccount(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta atualizada");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useFiscalPeriods() {
  return useQuery<FiscalPeriod[]>({
    queryKey: ["fiscal-periods"],
    queryFn: fetchFiscalPeriods,
  });
}

export function useCreateFiscalPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createFiscalPeriod,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal-periods"] });
      toast.success("Período fiscal criado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useCloseFiscalPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: closeFiscalPeriod,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal-periods"] });
      toast.success("Período fiscal fechado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useAccountingJournals() {
  return useQuery<AccountingJournal[]>({
    queryKey: ["accounting-journals"],
    queryFn: fetchAccountingJournals,
  });
}

export function useJournalEntries(params?: {
  journal_id?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery<JournalEntry[]>({
    queryKey: ["journal-entries", params],
    queryFn: () => fetchJournalEntries(params),
  });
}

export function useJournalEntry(id: number | null) {
  return useQuery<JournalEntry>({
    queryKey: ["journal-entry", id],
    queryFn: () => fetchJournalEntry(id!),
    enabled: id !== null,
  });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: JournalEntryCreate) => createJournalEntry(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      qc.invalidateQueries({ queryKey: ["trial-balance"] });
      toast.success("Lançamento criado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useGenerateEntryFromDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, journalId }: { docId: number; journalId: number }) =>
      generateEntryFromDocument(docId, journalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Lançamento gerado a partir do documento");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useGenerateEntryFromBankTx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ txId, journalId }: { txId: number; journalId: number }) =>
      generateEntryFromBankTx(txId, journalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Lançamento gerado a partir do movimento");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useTrialBalance(dateFrom?: string, dateTo?: string) {
  return useQuery<TrialBalanceReport>({
    queryKey: ["trial-balance", dateFrom, dateTo],
    queryFn: () => fetchTrialBalance(dateFrom, dateTo),
  });
}

export function useGeneralLedger(accountCode: string | null, dateFrom?: string, dateTo?: string) {
  return useQuery<GeneralLedgerRow[]>({
    queryKey: ["general-ledger", accountCode, dateFrom, dateTo],
    queryFn: () => fetchGeneralLedger(accountCode!, dateFrom, dateTo),
    enabled: accountCode !== null,
  });
}

export function useBalanceSheet(asOf?: string) {
  return useQuery<BalanceSheetReport>({
    queryKey: ["balance-sheet", asOf],
    queryFn: () => fetchBalanceSheet(asOf),
  });
}

export function useProfitLoss(params?: { year?: number; date_from?: string; date_to?: string }) {
  return useQuery<ProfitLossReport>({
    queryKey: ["profit-loss", params],
    queryFn: () => fetchProfitLoss(params),
  });
}
