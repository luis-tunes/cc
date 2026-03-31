"""Adapter for payroll document type: RV (Recibo de Vencimento)."""

from __future__ import annotations

from app.adapters import register_adapter


class PayrollAdapter:
    saft_codes = ["RV"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Recibo de Vencimento (RV)

### Key Characteristics
- Salary slip / pay stub — issued by employer to employee
- Complex structure with earnings, deductions, and contributions
- supplier_nif = employer NIF
- client_nif = employee NIF (if visible) or "000000000"

### Required Fields
- supplier_nif (employer)
- total (net salary — "Valor Líquido", "Líquido a Receber")
- base_amount (gross salary — "Vencimento Base", "Remuneração Bruta")
- date (payment period, e.g., "Mês de referência: Janeiro 2024")

### Salary Components (extract as line_items)
Earnings (positive):
- "Vencimento Base" / "Salário Base"
- "Subsídio de Alimentação" / "Sub. Refeição"
- "Subsídio de Natal" / "Sub. Férias"
- "Horas Extra" / "Trabalho Suplementar"
- "Ajudas de Custo" / "Deslocações"

Deductions (negative amounts):
- "IRS" / "Retenção IRS" (income tax withholding → withholding_tax field)
- "Segurança Social" / "TSU Trabalhador" (11% employee contribution)
- "Sindicato" / "Quotização Sindical"

### IMPORTANT
- withholding_tax = IRS retention amount
- vat = 0 (salaries have no VAT)
- The total should be NET (after all deductions)
- base_amount should be GROSS (before deductions)"""

    def get_required_fields(self) -> list[str]:
        return [
            "supplier_nif", "total", "base_amount", "date", "withholding_tax",
        ]


register_adapter(PayrollAdapter())
