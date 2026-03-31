"""AT/SAF-T PT document type taxonomy (Portaria 302/2016).

Canonical document types, families, and codes for Portuguese fiscal documents.
Used by the OCR pipeline for type detection and validation.
"""

from __future__ import annotations

# -- Document families (SAF-T InvoiceType groups) --

FAMILY_INVOICING = "faturacao"
FAMILY_TRANSPORT = "transporte"
FAMILY_PAYMENTS = "pagamentos"
FAMILY_BANKING = "bancario"
FAMILY_PAYROLL = "rh"
FAMILY_COMMERCIAL = "comercial"
FAMILY_OTHER = "outro"

# -- Canonical SAF-T document type codes --
# Maps SAF-T code → (internal_type, family, label_pt, direction_hint)
# direction_hint: "emitted" = issued by user, "received" = received by user, "either" = context-dependent

SAF_T_TYPES: dict[str, tuple[str, str, str, str]] = {
    # Faturação
    "FT": ("fatura", FAMILY_INVOICING, "Fatura", "either"),
    "FS": ("fatura-simplificada", FAMILY_INVOICING, "Fatura Simplificada", "either"),
    "FR": ("fatura-recibo", FAMILY_INVOICING, "Fatura-Recibo", "either"),
    "FP": ("fatura-proforma", FAMILY_INVOICING, "Fatura Pro-forma", "either"),
    "NC": ("nota-credito", FAMILY_INVOICING, "Nota de Crédito", "either"),
    "ND": ("nota-debito", FAMILY_INVOICING, "Nota de Débito", "either"),

    # Transporte
    "GT": ("guia-remessa", FAMILY_TRANSPORT, "Guia de Transporte", "emitted"),
    "GR": ("guia-remessa", FAMILY_TRANSPORT, "Guia de Remessa", "emitted"),
    "GA": ("guia-remessa", FAMILY_TRANSPORT, "Guia de Ativos", "emitted"),
    "GC": ("guia-remessa", FAMILY_TRANSPORT, "Guia de Consignação", "emitted"),
    "GD": ("guia-remessa", FAMILY_TRANSPORT, "Guia de Devolução", "either"),

    # Pagamentos
    "RC": ("recibo", FAMILY_PAYMENTS, "Recibo", "either"),
    "RG": ("recibo", FAMILY_PAYMENTS, "Recibo Global", "emitted"),

    # Bancário (operational, not SAF-T)
    "EB": ("extrato", FAMILY_BANKING, "Extrato Bancário", "received"),
    "CT": ("extrato", FAMILY_BANKING, "Comprovativo de Transferência", "emitted"),
    "TPA": ("extrato", FAMILY_BANKING, "Comprovativo TPA", "received"),

    # Recursos humanos
    "RV": ("recibo", FAMILY_PAYROLL, "Recibo de Vencimento", "emitted"),

    # Comercial
    "NE": ("orcamento", FAMILY_COMMERCIAL, "Nota de Encomenda", "emitted"),
    "OR": ("orcamento", FAMILY_COMMERCIAL, "Orçamento", "emitted"),
    "PF": ("orcamento", FAMILY_COMMERCIAL, "Fatura Pro-forma", "emitted"),
    "OU": ("outro", FAMILY_OTHER, "Outro Documento", "either"),
}

# Internal type → all SAF-T codes that map to it
INTERNAL_TO_SAFT: dict[str, list[str]] = {}
for code, (internal_type, _, _, _) in SAF_T_TYPES.items():
    INTERNAL_TO_SAFT.setdefault(internal_type, []).append(code)

# All valid internal document types
VALID_INTERNAL_TYPES = frozenset({v[0] for v in SAF_T_TYPES.values()} | {
    "fatura-fornecedor",  # Purchase invoice (FT received)
    "outro",
})

# Keywords → SAF-T code for pre-classification
TYPE_KEYWORDS: list[tuple[str, str]] = [
    ("fatura simplificada", "FS"),
    ("fatura-recibo", "FR"),
    ("fatura recibo", "FR"),
    ("fatura/recibo", "FR"),
    ("fatura pro-forma", "FP"),
    ("fatura proforma", "FP"),
    ("proforma", "FP"),
    ("nota de crédito", "NC"),
    ("nota de credito", "NC"),
    ("credit note", "NC"),
    ("nota de débito", "ND"),
    ("nota de debito", "ND"),
    ("debit note", "ND"),
    ("guia de transporte", "GT"),
    ("guia de remessa", "GR"),
    ("guia de devolução", "GD"),
    ("guia de devoluçao", "GD"),
    ("recibo de vencimento", "RV"),
    ("recibo", "RC"),
    ("extrato bancário", "EB"),
    ("extrato bancario", "EB"),
    ("bank statement", "EB"),
    ("comprovativo de transferência", "CT"),
    ("transferência bancária", "CT"),
    ("orçamento", "OR"),
    ("orcamento", "OR"),
    ("nota de encomenda", "NE"),
    ("fatura", "FT"),
    ("factura", "FT"),
    ("invoice", "FT"),
    ("rechnung", "FT"),
    ("bill", "FT"),
]

# SAF-T series prefixes that indicate document type
SERIES_PREFIXES: dict[str, str] = {
    "FT": "FT", "FS": "FS", "FR": "FR", "FP": "FP",
    "NC": "NC", "ND": "ND",
    "GT": "GT", "GR": "GR", "GA": "GA", "GC": "GC", "GD": "GD",
    "RC": "RC", "RG": "RG",
}


def classify_by_keywords(text: str) -> list[tuple[str, str, float]]:
    """Pre-classify document type from text keywords.

    Returns top candidates as (saft_code, internal_type, confidence) sorted by confidence desc.
    """
    text_lower = text.lower()
    candidates: list[tuple[str, str, float]] = []

    for keyword, saft_code in TYPE_KEYWORDS:
        if keyword in text_lower:
            internal_type = SAF_T_TYPES[saft_code][0]
            # Higher confidence for more specific keywords (longer = more specific)
            confidence = min(0.6 + len(keyword) * 0.02, 0.95)
            candidates.append((saft_code, internal_type, confidence))

    # Deduplicate by saft_code, keep highest confidence
    seen: dict[str, tuple[str, str, float]] = {}
    for saft_code, internal_type, conf in candidates:
        if saft_code not in seen or conf > seen[saft_code][2]:
            seen[saft_code] = (saft_code, internal_type, conf)

    return sorted(seen.values(), key=lambda x: x[2], reverse=True)[:3]


def classify_by_series_prefix(invoice_number: str) -> str | None:
    """Detect SAF-T code from invoice number series prefix (e.g., 'FT 2024/123' → 'FT')."""
    if not invoice_number:
        return None
    prefix = invoice_number.strip().split()[0].upper() if invoice_number.strip() else ""
    # Handle formats like "FT2024/123", "FT 2024/123", "FT A/123"
    for code in SERIES_PREFIXES:
        if prefix.startswith(code):
            return code
    return None


def saft_to_internal(saft_code: str) -> str:
    """Convert SAF-T code to internal document type."""
    entry = SAF_T_TYPES.get(saft_code.upper())
    return entry[0] if entry else "outro"


def internal_to_label(internal_type: str) -> str:
    """Get Portuguese label for internal type."""
    labels = {
        "fatura": "Fatura",
        "fatura-fornecedor": "Fatura de Fornecedor",
        "fatura-recibo": "Fatura-Recibo",
        "fatura-simplificada": "Fatura Simplificada",
        "fatura-proforma": "Fatura Pro-forma",
        "recibo": "Recibo",
        "nota-credito": "Nota de Crédito",
        "nota-debito": "Nota de Débito",
        "guia-remessa": "Guia de Remessa/Transporte",
        "extrato": "Extrato Bancário",
        "orcamento": "Orçamento",
        "outro": "Outro",
    }
    return labels.get(internal_type, "Outro")
