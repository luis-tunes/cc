export interface ForecastWeek {
  weekLabel: string;       // e.g. "10–16 Mar"
  startDate: string;
  inflows: number;
  outflows: number;
  taxObligations: number;
  netCash: number;
  runningBalance: number;
  confidenceHigh: number;  // upper band
  confidenceLow: number;   // lower band
  risks: ForecastRisk[];
}

export interface ForecastRisk {
  id: string;
  label: string;
  severity: "critico" | "atencao" | "info";
  amount?: number;
  description: string;
}

export interface ForecastScenario {
  id: string;
  label: string;
  description: string;
  modifier: number; // multiplier applied to outflows (1 = base)
}

export const forecastScenarios: ForecastScenario[] = [
  { id: "base", label: "Base", description: "Projeção com base nos padrões atuais", modifier: 1 },
  { id: "optimistic", label: "Otimista", description: "Recebimentos antecipados, gastos contidos", modifier: 0.85 },
  { id: "pessimistic", label: "Pessimista", description: "Atrasos em recebimentos, custos inesperados", modifier: 1.25 },
  { id: "stress", label: "Stress", description: "Perda de cliente principal + obrigação fiscal extra", modifier: 1.5 },
];

const BASE_BALANCE = 42_350;

function buildWeeks(): ForecastWeek[] {
  const rawWeeks: Omit<ForecastWeek, "runningBalance" | "confidenceHigh" | "confidenceLow">[] = [
    {
      weekLabel: "3–9 Mar", startDate: "2024-03-03",
      inflows: 18_200, outflows: 12_400, taxObligations: 0, netCash: 5_800,
      risks: [],
    },
    {
      weekLabel: "10–16 Mar", startDate: "2024-03-10",
      inflows: 14_600, outflows: 11_800, taxObligations: 0, netCash: 2_800,
      risks: [{ id: "r1", label: "Fatura #1042 em atraso", severity: "atencao", amount: 4_200, description: "Cliente Luso Têxtil — 12 dias de atraso" }],
    },
    {
      weekLabel: "17–23 Mar", startDate: "2024-03-17",
      inflows: 9_800, outflows: 15_200, taxObligations: 3_840, netCash: -9_240,
      risks: [
        { id: "r2", label: "IVA trimestral", severity: "critico", amount: 3_840, description: "Entrega IVA até 20 Mar — impacto direto na liquidez" },
        { id: "r3", label: "Semana negativa", severity: "atencao", description: "Saídas excedem entradas — saldo cai abaixo de €40k" },
      ],
    },
    {
      weekLabel: "24–30 Mar", startDate: "2024-03-24",
      inflows: 22_100, outflows: 13_600, taxObligations: 0, netCash: 8_500,
      risks: [],
    },
    {
      weekLabel: "31 Mar–6 Abr", startDate: "2024-03-31",
      inflows: 16_400, outflows: 14_200, taxObligations: 0, netCash: 2_200,
      risks: [{ id: "r4", label: "Modelo 22 em preparação", severity: "info", description: "Prazo IRC 31 Mai — começar preparação" }],
    },
    {
      weekLabel: "7–13 Abr", startDate: "2024-04-07",
      inflows: 13_900, outflows: 16_800, taxObligations: 0, netCash: -2_900,
      risks: [{ id: "r5", label: "Salários + Seg. Social", severity: "atencao", amount: 8_400, description: "Processamento salarial concentrado nesta semana" }],
    },
    {
      weekLabel: "14–20 Abr", startDate: "2024-04-14",
      inflows: 19_500, outflows: 11_200, taxObligations: 0, netCash: 8_300,
      risks: [],
    },
    {
      weekLabel: "21–27 Abr", startDate: "2024-04-21",
      inflows: 15_800, outflows: 12_900, taxObligations: 0, netCash: 2_900,
      risks: [],
    },
  ];

  let balance = BASE_BALANCE;
  return rawWeeks.map((w, i) => {
    balance += w.netCash;
    const uncertainty = 0.08 + i * 0.035; // grows with distance
    return {
      ...w,
      runningBalance: balance,
      confidenceHigh: balance * (1 + uncertainty),
      confidenceLow: balance * (1 - uncertainty),
    };
  });
}

export const forecastWeeks = buildWeeks();

export const forecastSummary = {
  currentBalance: BASE_BALANCE,
  projectedMin: Math.min(...forecastWeeks.map(w => w.confidenceLow)),
  projectedMax: Math.max(...forecastWeeks.map(w => w.confidenceHigh)),
  totalInflows: forecastWeeks.reduce((s, w) => s + w.inflows, 0),
  totalOutflows: forecastWeeks.reduce((s, w) => s + w.outflows, 0),
  totalTax: forecastWeeks.reduce((s, w) => s + w.taxObligations, 0),
  weeksTillShortfall: forecastWeeks.findIndex(w => w.runningBalance < 35_000),
  allRisks: forecastWeeks.flatMap(w => w.risks),
};

export const aiCommentary: { id: string; text: string; type: "insight" | "warning" | "action" }[] = [
  { id: "c1", type: "warning", text: "Semana de 17–23 Mar é crítica: entrega de IVA (€3.840) coincide com semana de baixos recebimentos. Saldo cairá para ~€38.900." },
  { id: "c2", type: "insight", text: "Padrão identificado: recebimentos concentram-se nas primeiras e últimas semanas do mês. Considere negociar prazos intermédios." },
  { id: "c3", type: "action", text: "Recomendação: antecipar cobrança da fatura #1042 (€4.200) para estabilizar liquidez na semana 10–16 Mar." },
  { id: "c4", type: "insight", text: "No cenário pessimista, o saldo atinge mínimo de ~€28k na semana de 7–13 Abr. Mantenha reserva de segurança acima de €25k." },
];
