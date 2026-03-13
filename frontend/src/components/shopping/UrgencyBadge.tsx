import { Badge } from "@/components/ui/badge";
import type { ShoppingListItem } from "@/lib/api";

const styles: Record<string, { label: string; className: string }> = {
  urgente: { label: "Urgente", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  alta: { label: "Alta", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  normal: { label: "Normal", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

export function UrgencyBadge({ urgency }: { urgency: ShoppingListItem["urgency"] }) {
  const s = styles[urgency] ?? styles.normal;
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}
