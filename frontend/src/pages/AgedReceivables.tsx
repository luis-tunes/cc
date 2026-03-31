import { useEffect, useState } from "react";
import { fetchAgedReceivables, type AgedReceivablesReport } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";

const BUCKET_LABELS: Record<string, string> = {
  current: "Corrente",
  overdue_1_30: "1–30 dias",
  overdue_31_60: "31–60 dias",
  overdue_61_90: "61–90 dias",
  overdue_90_plus: "90+ dias",
};

export default function AgedReceivables() {
  const [data, setData] = useState<AgedReceivablesReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgedReceivables()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageContainer title="Contas a Receber"><p>A carregar...</p></PageContainer>;
  if (!data) return <PageContainer title="Contas a Receber"><p>Sem dados disponíveis.</p></PageContainer>;

  return (
    <PageContainer title="Contas a Receber">
      <div className="mb-4 text-lg font-semibold">
        Total em aberto: {Number(data.total_outstanding).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        {Object.entries(BUCKET_LABELS).map(([key, label]) => {
          const bucket = data[key as keyof AgedReceivablesReport];
          if (typeof bucket === "string") return null;
          return (
            <div key={key} className="rounded-lg border p-4">
              <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
              <p className="mt-1 text-xl font-bold">
                {Number(bucket.total).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}
              </p>
              <p className="text-xs text-muted-foreground">{bucket.items.length} faturas</p>
            </div>
          );
        })}
      </div>
    </PageContainer>
  );
}
