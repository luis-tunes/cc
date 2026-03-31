"""Adapters for government/tax authority document types: AT, SS payments."""

from __future__ import annotations

from app.adapters import register_adapter


class GovernmentPaymentAdapter:
    """Adapter for AT (Autoridade Tributária) and SS (Segurança Social) payment documents."""
    saft_codes = ["AT_PAY", "SS_PAY"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Documentos AT / Segurança Social

### Key Characteristics
- Government payment documents (IVA, IRC, IRS, TSU, etc.)
- Issued by or paid to Autoridade Tributária or Segurança Social
- supplier_nif will be AT (600084779) or SS (500745260) NIF

### AT (Autoridade Tributária) Documents
- IVA payment ("Declaração Periódica de IVA", "Pagamento de IVA")
- IRC payment ("Pagamento Especial por Conta", "Pagamento por Conta IRC")
- IRS withholding ("Guia de Retenção IRS", "DMR")
- Stamp duty ("Imposto de Selo")

### SS (Segurança Social) Documents
- TSU payment ("Declaração de Remunerações", "Contribuição SS")
- Employee/employer contributions

### Required Fields
- total (payment amount)
- date (payment date or reference period)
- description: include tax type (IVA/IRC/IRS/TSU) and reference period
- supplier_nif: AT NIF (600084779) or SS NIF (500745260) if paying TO them
- payment_method if visible

### Payment References
- Look for: "Referência de pagamento", "Nº de liquidação", "Período"
- DUC (Documento Único de Cobrança) reference number"""

    def get_required_fields(self) -> list[str]:
        return ["total", "date", "description"]


register_adapter(GovernmentPaymentAdapter())
