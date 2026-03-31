"""Adapters for commercial document types: NE, OR, PF, OU."""

from __future__ import annotations

from app.adapters import register_adapter


class PurchaseOrderAdapter:
    saft_codes = ["NE"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Nota de Encomenda (NE)

### Key Characteristics
- Purchase order — NOT a fiscal document, no ATCUD required
- Represents intent to buy, not a completed transaction
- May not have final amounts (estimates/quotes)

### Required Fields
- invoice_number (NE prefix or order reference)
- supplier_nif (vendor receiving the order)
- total (estimated amount)
- date (order date)
- line_items (ordered items with quantities)

### Notes
- Delivery date may be present ("Data de entrega prevista")
- Payment terms may be specified"""

    def get_required_fields(self) -> list[str]:
        return ["invoice_number", "total", "date"]


class QuoteAdapter:
    saft_codes = ["OR"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Orçamento (OR)

### Key Characteristics
- Quote/proposal — NOT a fiscal document
- Contains proposed pricing, may include validity period
- No ATCUD required

### Required Fields
- invoice_number (quote reference)
- supplier_nif (who issued the quote)
- total (quoted amount)
- date (quote date)
- line_items (quoted items/services)

### Notes
- Look for "Válido até", "Prazo de validade" → extract as due_date
- "Condições de pagamento" → extract payment terms in description"""

    def get_required_fields(self) -> list[str]:
        return ["supplier_nif", "total", "date"]


class OtherDocumentAdapter:
    saft_codes = ["PF", "OU"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Outros Documentos (PF/OU)

### Key Characteristics
- Catch-all for documents that don't fit other categories
- Extract as much structured data as possible

### Required Fields
- Extract all available fields
- If document type is ambiguous, describe it in the description field"""

    def get_required_fields(self) -> list[str]:
        return ["date"]


register_adapter(PurchaseOrderAdapter())
register_adapter(QuoteAdapter())
register_adapter(OtherDocumentAdapter())
