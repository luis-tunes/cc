import { cn } from "@/lib/utils";
import { useState } from "react";
import { vatPeriods, vatTrend } from "@/lib/tax-data";
import { KpiCard } from "@/components/shared/KpiCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Receipt } from "lucide-react";

export function IvaOverviewPanel({ className }: { className?: string }) {
  const [selectedPeriod, setSelectedPeriod] = useState(vatPeriods[0].period);
  const period = vatPeriods.find((p) => p.period === selectedPeriod) ?? vatPeriods[0];

  const fmt = (v: number) => `€${v.toLocaleString("pt-PT")}`;

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">IVA</h3>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vatPeriods.map((p) => (
              <SelectItem key={p.period} value={p.period} className="text-xs">
                {p.period}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="IVA Liquidado" value={fmt(period.collected)} compact />
          <KpiCard label="IVA Dedutível" value={fmt(period.deductible)} compact />
          <KpiCard label="IVA a Pagar" value={fmt(period.payable)} accent compact variant="warning" icon={Receipt} />
        </div>

        {/* Rate split */}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Repartição por Taxa
          </p>
          <div className="flex gap-2">
            {[
              { rate: "6%", value: period.rate6, color: "bg-tim-info" },
              { rate: "13%", value: period.rate13, color: "bg-tim-warning" },
              { rate: "23%", value: period.rate23, color: "bg-primary" },
            ].map((r) => (
              <div key={r.rate} className="flex-1 rounded-md bg-muted/50 px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <div className={cn("h-1.5 w-1.5 rounded-full", r.color)} />
                  <span className="text-[10px] font-medium text-muted-foreground">{r.rate}</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{fmt(r.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trend chart */}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Tendência Mensal
          </p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={vatTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="colCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(40 80% 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(40 80% 55%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colDeductible" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210 60% 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(210 60% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 12% 16%)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(220 10% 55%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(220 10% 55%)" }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `€${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(220 18% 9%)", border: "1px solid hsl(220 12% 16%)", borderRadius: 8, fontSize: 11 }}
                  formatter={(value: number, name: string) => [fmt(value), name === "collected" ? "Liquidado" : "Dedutível"]}
                />
                <Area type="monotone" dataKey="collected" stroke="hsl(40 80% 55%)" fill="url(#colCollected)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="deductible" stroke="hsl(210 60% 50%)" fill="url(#colDeductible)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
