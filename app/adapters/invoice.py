"""Adapters for invoice document types: FT, FR, FS, FP."""

from __future__ import annotations

from app.adapters import register_adapter


class InvoiceAdapter:
    saft_codes = ["FT", "FR", "FP"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Fatura / Fatura-Recibo / Fatura Pro-forma

### Required Fields
- invoice_number (MUST include series prefix: "FT 2024/1234", "FR A/5678")
- supplier_nif (issuer — the company that created this invoice)
- total, base_amount, vat
- vat_breakdown per rate
- date (issue date)

### Line Items (CRITICAL for invoices)
- Extract EVERY line item: description, quantity, unit_price, vat_rate, line_total
- If unit_price not shown, compute: line_total / qty
- If qty not shown, default to 1
- Each line's vat_rate should match a rate in vat_breakdown

### Payment Terms
- Look for "Vencimento", "Data limite de pagamento", "Prazo de pagamento"
- Extract due_date if present
- Extract payment_method ("Transferência", "Multibanco", "MBWay", etc.)

### FR (Fatura-Recibo) specifics
- Functions as both invoice AND receipt — payment was already made
- payment_method is ESPECIALLY important for FR documents
- Look for "Pago", "Liquidado", "Recebido" confirmations

### FP (Pro-forma) specifics
- Not a fiscal document — no ATCUD required
- Cannot be used as tax deduction evidence
- Look for "Pro-forma" or "Não serve de fatura" disclaimers"""

    def get_required_fields(self) -> list[str]:
        return [
            "invoice_number", "supplier_nif", "total", "base_amount", "vat",
            "vat_breakdown", "date", "line_items",
        ]


class SimplifiedInvoiceAdapter:
    saft_codes = ["FS"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Fatura Simplificada (FS)

### Key Differences from Regular Invoice
- client_nif may be ABSENT (anonymous sale ≤ €1000 or ≤ €100 for services)
- If no client NIF visible, set client_nif to "999999990" (Consumidor Final)
- Line items may be abbreviated or grouped
- VAT may be included in prices (IVA incluído)

### Required Fields
- invoice_number (with FS prefix)
- supplier_nif
- total (may be the only amount — IVA incluído)
- date

### Supermarket/Retail Patterns
- Quantities may appear as: "2x1.99", "2 x 1,99", "2UN x 1,99"
- Weight items: "0,542 kg x 12,99/kg"
- Look for EAN/barcode numbers (13 digits) — NOT NIFs
- Promotions: "Desconto", "Promoção", "-0,50" (negative amounts)
- Loyalty cards: "Cartão Cliente" — not a payment method"""

    def get_required_fields(self) -> list[str]:
        return ["invoice_number", "supplier_nif", "total", "date"]


# Register adapters
register_adapter(InvoiceAdapter())
register_adapter(SimplifiedInvoiceAdapter())
