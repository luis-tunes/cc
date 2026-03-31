"""Adapters for credit/debit note types: NC, ND."""

from __future__ import annotations

from app.adapters import register_adapter


class CreditNoteAdapter:
    saft_codes = ["NC"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Nota de Crédito (NC)

### Key Characteristics
- Reverses or corrects a previous invoice (FT/FR/FS)
- Amounts may be POSITIVE (representing the credit) or NEGATIVE
- MUST reference the original document

### Required Fields
- invoice_number (NC prefix: "NC 2024/123")
- Reference to original: look for "Ref.", "Referente a", "Fatura nº", "Anula", "Corrige"
- supplier_nif (same issuer as original invoice)
- total, vat (the credited/reversed amounts)
- date
- Reason/description: "Devolução", "Desconto", "Erro de faturação", "Anulação"

### Extraction Notes
- If amounts are shown as positive, they represent the credit value
- The description should explain WHY the credit was issued
- vat_breakdown should match the rates of the original invoice"""

    def get_required_fields(self) -> list[str]:
        return [
            "invoice_number", "supplier_nif", "total", "vat", "date", "description",
        ]


class DebitNoteAdapter:
    saft_codes = ["ND"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Nota de Débito (ND)

### Key Characteristics
- Additional charge on top of a previous invoice
- References the original document
- Common for: price adjustments, additional charges, penalties

### Required Fields
- invoice_number (ND prefix: "ND 2024/123")
- Reference to original invoice
- supplier_nif
- total, vat (additional amounts being charged)
- date
- Reason/description for the additional charge"""

    def get_required_fields(self) -> list[str]:
        return [
            "invoice_number", "supplier_nif", "total", "vat", "date", "description",
        ]


register_adapter(CreditNoteAdapter())
register_adapter(DebitNoteAdapter())
