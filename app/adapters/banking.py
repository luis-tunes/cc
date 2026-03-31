"""Adapters for banking document types: EB, CT, TPA."""

from __future__ import annotations

from app.adapters import register_adapter


class BankStatementAdapter:
    saft_codes = ["EB"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Extrato Bancário (EB)

### Key Characteristics
- Bank statement — NOT a fiscal document, no ATCUD
- Contains multiple MOVEMENTS (transactions), not a single amount
- The "total" should be the closing balance or net movement

### Required Fields
- supplier_nif = bank's NIF (if visible)
- client_nif = account holder's NIF (our entity)
- date = statement period end date
- description = bank name + account + period

### Line Items = Bank Movements
Extract each movement as a line_item:
- description: transaction description ("TRF", "DD", "COM", "JUR")
- total: movement amount (positive for credits, negative for debits)
- qty: 1 (always)
- unit_price: same as total
- vat_rate: 0

### Bank-Specific Fields (extract in description)
- IBAN of the account
- Opening balance ("Saldo inicial", "Saldo anterior")
- Closing balance ("Saldo final", "Saldo disponível")
- Statement period (start and end dates)

### IMPORTANT
- Do NOT set vat or base_amount — bank statements have no VAT
- payment_method should be empty (this IS the payment record)"""

    def get_required_fields(self) -> list[str]:
        return ["date", "description"]


class BankTransferAdapter:
    saft_codes = ["CT"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Comprovativo de Transferência (CT)

### Key Characteristics
- Proof of bank transfer — single payment
- NOT a fiscal document, no ATCUD

### Required Fields
- total (transfer amount)
- date (transfer date, "Data da operação")
- payment_method = "transferência"
- description: include payer/payee names and reference

### Transfer-Specific Fields (extract in description)
- Payer IBAN ("IBAN de origem", "Conta de débito")
- Payee IBAN ("IBAN de destino", "Conta de crédito")
- Transfer reference ("Referência", "Descrição")
- Payer and payee names"""

    def get_required_fields(self) -> list[str]:
        return ["total", "date"]


class TPAAdapter:
    saft_codes = ["TPA"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Comprovativo TPA (TPA)

### Key Characteristics
- Card terminal payment proof
- Contains transaction details and merchant info

### Required Fields
- total (transaction amount)
- date (transaction date/time)
- payment_method = "cartão"
- description: include card type, last 4 digits, authorization code"""

    def get_required_fields(self) -> list[str]:
        return ["total", "date"]


register_adapter(BankStatementAdapter())
register_adapter(BankTransferAdapter())
register_adapter(TPAAdapter())
