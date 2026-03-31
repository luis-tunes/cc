import { Badge } from "@/components/ui/badge";
import type { ShoppingListItem } from "@/lib/api";

const styles: Record<string, { label: string; className: string }> = {
  urgente: { label: "Urgente", className: "bg-tim-danger/15 text-tim-danger border-tim-danger/30" },
  alta: { label: "Alta", className: "bg-tim-warning/15 text-tim-warning border-tim-warning/30" },
  normal: { label: "Normal", className: "bg-tim-info/15 text-tim-info border-tim-info/30" },
};

export function UrgencyBadge({ urgency }: { urgency: ShoppingListItem["urgency"] }) {
  const s = styles[urgency] ?? styles.normal;
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}
