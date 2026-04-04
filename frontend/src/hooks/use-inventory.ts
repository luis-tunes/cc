import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  fetchStockEvents,
  createStockEvent,
  fetchInventoryStats,
  fetchShoppingList,
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  produceProduct,
  fetchProductCost,
  fetchStockImpact,
  fetchUnitFamilies,
  addPricePoint,
  importIngredientsCSV,
  importProductsCSV,
  type Ingredient,
  type StockEvent,
  type InventoryStats,
  type ShoppingListItem,
  type Supplier,
  type Product,
  type ProductCost,
  type StockImpact,
  type UnitFamily,
  type PricePoint,
  type BulkImportResult,
} from "@/lib/api";

// ── Ingredients ──────────────────────────────────────────────────────

export function useIngredients(params?: { category?: string; status_filter?: string }) {
  return useQuery<Ingredient[]>({
    queryKey: ["ingredients", params],
    queryFn: () => fetchIngredients(params),
  });
}

export function useCreateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Ingredient>) => createIngredient(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      toast.success("Ingrediente criado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useUpdateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Ingredient> & { id: number }) => updateIngredient(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success("Ingrediente atualizado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeleteIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteIngredient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      toast.success("Ingrediente removido");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

// ── Stock Events ─────────────────────────────────────────────────────

export function useStockEvents(params?: { ingredient_id?: number; event_type?: string; limit?: number }) {
  return useQuery<StockEvent[]>({
    queryKey: ["stock-events", params],
    queryFn: () => fetchStockEvents(params),
  });
}

export function useCreateStockEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createStockEvent,
    onSuccess: (ev) => {
      qc.invalidateQueries({ queryKey: ["stock-events"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      qc.invalidateQueries({ queryKey: ["shopping-list"] });
      const labels: Record<string, string> = {
        entrada: "Entrada registada",
        "saída": "Saída registada",
        "desperdício": "Desperdício registado",
        ajuste: "Ajuste registado",
      };
      toast.success(labels[ev.type] || "Evento registado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

// ── Inventory Stats & Shopping List ──────────────────────────────────

export function useInventoryStats() {
  return useQuery<InventoryStats>({
    queryKey: ["inventory-stats"],
    queryFn: fetchInventoryStats,
  });
}

export function useShoppingList() {
  return useQuery<ShoppingListItem[]>({
    queryKey: ["shopping-list"],
    queryFn: fetchShoppingList,
  });
}

// ── Suppliers ────────────────────────────────────────────────────────

export function useSuppliers() {
  return useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Supplier>) => createSupplier(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fornecedor criado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Supplier> & { id: number }) => updateSupplier(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fornecedor atualizado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSupplier(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fornecedor removido");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

// ── Products ─────────────────────────────────────────────────────────

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto criado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Product> & { id: number }) => updateProduct(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto atualizado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto removido");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useProduceProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, qty }: { id: number; qty: number }) => produceProduct(id, qty),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: ["stock-events"] });
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      toast.success(`${data.produced}× ${data.product} produzido`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useProductCost(id: number) {
  return useQuery<ProductCost>({
    queryKey: ["product-cost", id],
    queryFn: () => fetchProductCost(id),
    enabled: id > 0,
  });
}

export function useStockImpact(id: number, qty: number) {
  return useQuery<StockImpact>({
    queryKey: ["stock-impact", id, qty],
    queryFn: () => fetchStockImpact(id, qty),
    enabled: id > 0 && qty > 0,
  });
}

// ── Unit Families ────────────────────────────────────────────────────

export function useUnitFamilies() {
  return useQuery<UnitFamily[]>({
    queryKey: ["unit-families"],
    queryFn: fetchUnitFamilies,
  });
}

// ── Price History ────────────────────────────────────────────────────

export function useAddPricePoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addPricePoint,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      toast.success("Preço registado");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

// ── Bulk Import ──────────────────────────────────────────────────────

export function useImportIngredients() {
  const qc = useQueryClient();
  return useMutation<BulkImportResult, Error, File>({
    mutationFn: importIngredientsCSV,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      toast.success(`${data.imported} ingredientes importados`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useImportProducts() {
  const qc = useQueryClient();
  return useMutation<BulkImportResult, Error, File>({
    mutationFn: importProductsCSV,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      const parts = [`${data.imported} produtos importados`];
      if (data.skipped) parts.push(`${data.skipped} duplicados ignorados`);
      toast.success(parts.join(", "));
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}
