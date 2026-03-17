import { useMemo } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";

function cssVar(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `hsl(${raw})` : "";
}

export interface ChartColors {
  grid: string;
  tick: string;
  tooltipBg: string;
  tooltipBorder: string;
  gold: string;
  success: string;
  danger: string;
  warning: string;
  info: string;
  muted: string;
  pie: string[];
}

export function useChartColors(): ChartColors {
  const { resolved } = useTheme();

  return useMemo(() => {
    // Resolve CSS variables for current theme
    const gold = cssVar("--chart-1") || cssVar("--tim-gold");
    const success = cssVar("--chart-2") || cssVar("--tim-success");
    const info = cssVar("--chart-3") || cssVar("--tim-info");
    const warning = cssVar("--chart-4") || cssVar("--tim-warning");
    const danger = cssVar("--chart-5") || cssVar("--tim-danger");
    const muted = cssVar("--muted-foreground");

    const grid = cssVar("--border");
    const tick = cssVar("--muted-foreground");
    const tooltipBg = cssVar("--card");
    const tooltipBorder = cssVar("--border");

    return {
      grid,
      tick,
      tooltipBg,
      tooltipBorder,
      gold,
      success,
      danger,
      warning,
      info,
      muted,
      pie: [gold, success, info, warning, danger,
            "hsl(270, 60%, 55%)", "hsl(180, 50%, 45%)", "hsl(320, 60%, 55%)"],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);
}

/** Shared tooltip contentStyle for Recharts */
export function tooltipStyle(colors: ChartColors): React.CSSProperties {
  return {
    backgroundColor: colors.tooltipBg,
    border: `1px solid ${colors.tooltipBorder}`,
    borderRadius: 8,
    fontSize: 12,
  };
}
