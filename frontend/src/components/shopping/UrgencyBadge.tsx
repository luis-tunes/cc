import { Badge } from "@/components/ui/badge";
import type { ShoppingListItem } from "@/lib/api";

const styles: Record<string, { label: string; className: string }> = {
  urgente: { label: "Urgente", className: "bg-red-100 text-red-600 border-red-200" },
  alta: { label: "Alta", className: "bg-orange-100 text-orange-600 border-orange-200" },
  normal: { label: "Normal", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

export function UrgencyBadge({ urgency }: { urgency: ShoppingListItem["urgency"] }) {
  const s = styles[urgency] ?? styles.normal;
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}
