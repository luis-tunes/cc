"""Adapters for transport/logistics document types: GT, GR, GA, GC, GD."""

from __future__ import annotations

from app.adapters import register_adapter


class TransportGuideAdapter:
    saft_codes = ["GT"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Guia de Transporte (GT)

### Key Characteristics
- LOGISTICS document — NOT a financial document
- NO monetary amounts (total, vat, base_amount should be 0)
- Mandatory for goods in transit per AT regulations
- ATCUD is MANDATORY

### Required Fields
- invoice_number (GT prefix)
- supplier_nif (issuer / sender)
- client_nif (recipient / receiver)
- date (transport date)
- atcud (mandatory for GT)
- description (goods being transported)

### Transport-Specific Fields (extract in description)
- Load address ("Local de carga", "Morada de origem")
- Unload address ("Local de descarga", "Morada de destino")
- Vehicle registration ("Matrícula", "Viatura")
- Transport start time ("Hora de início")
- Goods description and quantities

### IMPORTANT
- Set total=0, vat=0, base_amount=0 for transport guides
- Do NOT extract monetary values from GT documents"""

    def get_required_fields(self) -> list[str]:
        return [
            "invoice_number", "supplier_nif", "client_nif", "date", "atcud",
            "description",
        ]


class RemittanceGuideAdapter:
    saft_codes = ["GR", "GA", "GC", "GD"]

    def get_overlay(self) -> str:
        return """\
## TYPE-SPECIFIC RULES: Guia de Remessa/Ativos/Consignação/Devolução (GR/GA/GC/GD)

### Key Characteristics
- Accompanies goods delivery or movement
- GR: delivery note (may have monetary values)
- GA: asset transfer guide
- GC: consignment note
- GD: return guide (goods being sent back)

### Required Fields
- invoice_number (GR/GA/GC/GD prefix)
- supplier_nif, client_nif
- date
- description (goods being moved)

### GD (Devolução) Specifics
- References the original document (invoice or delivery note)
- Look for: "Devolução de", "Ref.", "Referente a"
- Include reason for return in description"""

    def get_required_fields(self) -> list[str]:
        return [
            "invoice_number", "supplier_nif", "client_nif", "date", "description",
        ]


register_adapter(TransportGuideAdapter())
register_adapter(RemittanceGuideAdapter())
