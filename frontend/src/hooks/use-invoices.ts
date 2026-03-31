import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchInvoiceSeries,
  createInvoiceSeries,
  fetchInvoices,
  fetchInvoice,
  createInvoice,
  patchInvoice,
  finalizeInvoice,
  voidInvoice,
  deleteInvoice,
  fetchInvoiceSummary,
  fetchInvoicePayments,
  createInvoicePayment,
  deleteInvoicePayment,
  fetchAgedReceivables,
  type InvoiceSeries,
  type InvoiceSeriesCreate,
  type Invoice,
  type InvoiceCreate,
  type InvoiceUpdate,
  type InvoiceSummary,
  type InvoicePayment,
  type PaymentCreate,
  type AgedReceivablesReport,
} from "@/lib/api";
import { toast } from "sonner";

export type { InvoiceSeries, Invoice, InvoiceCreate, InvoiceUpdate, InvoiceSummary, InvoicePayment, AgedReceivablesReport };

export function useInvoiceSeries() {
  return useQuery<InvoiceSeries[]>({
    queryKey: ["invoice-series"],
    queryFn: fetchInvoiceSeries,
  });
}

export function useCreateInvoiceSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createInvoiceSeries,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice-series"] });
      toast.success("Série criada");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useInvoices(params?: {
  status?: string;
  document_type?: string;
  customer_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery<Invoice[]>({
    queryKey: ["invoices", params],
    queryFn: () => fetchInvoices(params),
  });
}

export function useInvoice(id: number | null) {
  return useQuery<Invoice>({
    queryKey: ["invoice", id],
    queryFn: () => fetchInvoice(id!),
    enabled: id != null,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Fatura criada");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function usePatchInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: InvoiceUpdate }) => patchInvoice(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
      toast.success("Fatura atualizada");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useFinalizeInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: finalizeInvoice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
      toast.success("Fatura emitida");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: voidInvoice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
      toast.success("Fatura anulada");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Fatura eliminada");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useInvoiceSummary(year?: number) {
  return useQuery<InvoiceSummary>({
    queryKey: ["invoices-summary", year],
    queryFn: () => fetchInvoiceSummary(year),
  });
}

export function useInvoicePayments(invoiceId: number | null) {
  return useQuery<InvoicePayment[]>({
    queryKey: ["invoice-payments", invoiceId],
    queryFn: () => fetchInvoicePayments(invoiceId!),
    enabled: invoiceId != null,
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: number; data: PaymentCreate }) =>
      createInvoicePayment(invoiceId, data),
    onSuccess: (_d, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: ["invoice-payments", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      toast.success("Pagamento registado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, paymentId }: { invoiceId: number; paymentId: number }) =>
      deleteInvoicePayment(invoiceId, paymentId),
    onSuccess: (_d, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: ["invoice-payments", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      toast.success("Pagamento eliminado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useAgedReceivables() {
  return useQuery<AgedReceivablesReport>({
    queryKey: ["aged-receivables"],
    queryFn: fetchAgedReceivables,
  });
}
