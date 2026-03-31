"""Adapters for receipt/payment types: RC, RG."""

from __future__ import annotations

from app.adapters import register_adapter


class ReceiptAdapter:
    saft_codes = ["RC", "RG"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Recibo (RC) / Recibo Global (RG)

### Key Characteristics
- Proof of payment received — NOT an invoice
- MUST have payment_method (this is the most important field after amounts)
- References the invoice(s) being paid

### Required Fields
- invoice_number (RC/RG prefix)
- payment_method — MANDATORY: "transferência", "multibanco", "mbway", "dinheiro", "cheque", "cartão"
- Look for: "Forma de Pagamento", "Meio de Pagamento", "Pago por"
- total (amount paid)
- supplier_nif (who issued the receipt = who received the payment)
- date (payment date)

### Payment References
- Multibanco: entity + reference + amount
- Transferência: IBAN or bank details
- MBWay: phone number
- Cheque: cheque number

### RG (Recibo Global) specifics
- Covers multiple invoices in a single receipt
- Look for list of referenced documents with amounts"""

    def get_required_fields(self) -> list[str]:
        return [
            "invoice_number", "supplier_nif", "total", "date", "payment_method",
        ]


register_adapter(ReceiptAdapter())
