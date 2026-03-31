"""Prompt assembly system — composes LLM extraction prompts from modular components.

Assembles: base_prompt + owner_context + pre_extracted_hints + type_adapter_overlay

The assembled prompt replaces the static _LLM_EXTRACTION_PROMPT with a dynamic
prompt that is tailored to the specific document being processed.
"""

from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import Any

from app.adapters import get_overlay_for_type
from app.entity_resolver import OwnerEntity
from app.schemas.extraction import DeterministicHints

log = logging.getLogger(__name__)


# -- Base prompt (shared across all document types) --

_BASE_PROMPT = """\
You are an expert Portuguese certified accountant (TOC) and fiscal document analyst with deep knowledge of AT/SAF-T PT taxonomy (Portaria 302/2016).
Your task: extract ALL structured data from this Portuguese accounting document with maximum precision.

## THINKING PROCESS (before outputting JSON)
1. Identify document TYPE from header codes (FT, FR, FS, NC, ND, RC, GR) or keywords
2. Identify the ISSUER (emitente) from letterhead/logo area — their NIF = supplier_nif
3. Identify the RECIPIENT (destinatário/cliente/adquirente) — their NIF = client_nif
4. Locate the AMOUNTS TABLE: total, base tributável, IVA per rate
5. Extract LINE ITEMS with quantities, unit prices, VAT rates
6. VERIFY: total = base_amount + vat (±€0.02 for rounding). If not, re-read the amounts
7. Extract ATCUD code if visible (format: ATCUD:XXXXXXXX-NNNNN)

Return ONLY valid JSON with these exact fields:
{
  "invoice_number": string (document number e.g. "FT 2024/1234", "FR A/5678", "RC 2024/99", "" if not found),
  "total": number (total final amount WITH IVA in EUR — "Total a Pagar", "Total c/ IVA", "Montante Total", 0 if not found),
  "base_amount": number (taxable base WITHOUT IVA — "Base Tributável", "Incidência", "Subtotal s/ IVA", 0 if not found),
  "vat": number (total IVA/VAT amount in EUR, 0 if not found),
  "vat_breakdown": [{"rate": number, "base": number, "amount": number}],
  "discount": number (discount amount in EUR, 0 if none),
  "withholding_tax": number (retenção na fonte amount in EUR, 0 if none),
  "supplier_nif": string (9-digit NIF of the ISSUER/EMITTER, "000000000" if not found),
  "supplier_name": string (company name of the issuer, "" if not found),
  "client_nif": string (9-digit NIF of the CLIENT/BUYER/RECIPIENT, "000000000" if not found),
  "client_name": string (company/person name of the client, "" if not found),
  "date": string (document issue date in ISO YYYY-MM-DD, null if not found),
  "due_date": string (payment due date in ISO YYYY-MM-DD, null if not found),
  "type": string (one of: "fatura", "fatura-fornecedor", "fatura-recibo", "fatura-simplificada", "fatura-proforma", "recibo", "nota-credito", "nota-debito", "extrato", "guia-remessa", "orcamento", "outro"),
  "payment_method": string ("transferência", "multibanco", "mbway", "dinheiro", "cheque", "cartão", "débito direto", "" if not found),
  "description": string (brief summary of goods/services, max 120 chars, in Portuguese),
  "line_items": [{"description": string, "qty": number, "unit_price": number, "vat_rate": number, "total": number}],
  "atcud": string (ATCUD code if present, "" if not found),
  "currency": string ("EUR" default, or detected currency code)
}

## CRITICAL EXTRACTION RULES — Portuguese Fiscal Documents

### Amounts
- PT format: dot=thousands, comma=decimals → 1.234,56 = 1234.56
- ALWAYS return numbers as plain JSON numbers (1234.56), NEVER strings
- "Total a Pagar" / "Total c/ IVA" / "Total do Documento" / "Valor Total" = total (WITH IVA)
- "Base Tributável" / "Incidência" / "Base de Incidência" / "Total s/ IVA" / "Subtotal" = base_amount (WITHOUT IVA)
- If base_amount not explicitly stated: base_amount = total - vat
- Verify: total ≈ base_amount + vat (± rounding). If not, re-check values

### VAT (IVA)
- Standard PT rates: 23% (normal), 13% (intermédia), 6% (reduzida), 0% (isenta)
- Azores: 16%, 9%, 4%. Madeira: 22%, 12%, 5%
- Extract EACH rate separately into vat_breakdown
- "Isento de IVA" / "IVA 0%" with legal article reference = tax exempt (rate 0)

### NIF Identification (CRITICAL)
- NIF = exactly 9 digits, validated by mod-11 algorithm
- Valid prefix digits: 1,2,3 (individual), 5 (collective/Lda/SA), 6 (public), 7,8,9 (reserved/foreign)
- The ISSUER/EMITTER (letterhead/header area) = supplier_nif
- The RECIPIENT/CLIENT (below header, "Cliente"/"Adquirente" section) = client_nif
- If only ONE NIF found → it is supplier_nif. Set client_nif to "000000000"
- supplier_nif and client_nif must be DIFFERENT

### Common OCR Errors
- "l" ↔ "1", "O" ↔ "0", "S" ↔ "5", "B" ↔ "8" in degraded scans
- Comma ↔ period confusion: verify using PT format (comma=decimal)

### Dates
- PT formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, "3 de janeiro de 2024"
- ALWAYS output ISO format: YYYY-MM-DD

### ATCUD / QR Code
- ATCUD format: "ATCUD:XXXXXXXX-N" (alphanumeric validation code)

IMPORTANT: Extract EVERYTHING visible. When uncertain, extract your best guess rather than returning empty/zero.
Never hallucinate data that is not in the document."""


def assemble_prompt(
    owner_entities: list[OwnerEntity] | None = None,
    hints: DeterministicHints | None = None,
    saft_code: str | None = None,
) -> str:
    """Assemble the full extraction prompt from modular components.

    Args:
        owner_entities: Tenant's known entities for direction detection
        hints: Pre-extracted deterministic values (NIFs, dates, amounts, ATCUD)
        saft_code: Pre-classified SAF-T document type code

    Returns:
        Complete prompt string ready for the LLM system message.
    """
    sections: list[str] = [_BASE_PROMPT]

    # Owner context
    if owner_entities:
        sections.append(_build_owner_context(owner_entities))

    # Pre-extracted hints
    if hints:
        sections.append(_build_hints_section(hints))

    # Type-specific adapter overlay
    if saft_code:
        overlay = get_overlay_for_type(saft_code)
        if overlay:
            sections.append(overlay)

    # Self-verification checklist (always last)
    sections.append(_VERIFICATION_CHECKLIST)

    return "\n\n".join(sections)


# -- Owner context section --

def _build_owner_context(entities: list[OwnerEntity]) -> str:
    """Build the owner entity context section for the prompt."""
    lines = [
        "## OWNER ENTITY CONTEXT",
        "The document owner (our company/person) operates under these identities:",
    ]

    for i, entity in enumerate(entities):
        parts = []
        if entity.nif:
            parts.append(f"NIF: {entity.nif}")
        if entity.name:
            parts.append(f'Name: "{entity.name}"')
        if entity.ibans:
            parts.append(f"IBAN: {entity.ibans[0]}")
        label = "(primary)" if entity.is_primary else ""
        lines.append(f"- Entity {i + 1} {label}: {', '.join(parts)}")

    lines.extend([
        "",
        "### Direction Detection Rules:",
        "- If supplier_nif matches one of OUR entities → this is a document WE ISSUED (sales/outbound)",
        "  → classify as fatura (not fatura-fornecedor)",
        "- If client_nif matches one of OUR entities → this is a document WE RECEIVED (purchase/inbound)",
        "  → classify as fatura-fornecedor (purchase invoice)",
        "- If BOTH NIFs match our entities → internal document",
        "- Use entity names to validate NIF assignments if NIFs are unclear",
    ])

    return "\n".join(lines)


# -- Pre-extracted hints section --

def _build_hints_section(hints: DeterministicHints) -> str:
    """Build the pre-extracted hints section for the prompt."""
    lines = [
        "## PRE-EXTRACTED HINTS (from deterministic parsing)",
        "We already extracted these values via regex. Use them as reference points to VALIDATE your extraction.",
        "If your extraction conflicts with these hints and the document is unclear, prefer the hints as tiebreaker.",
    ]

    if hints.nifs:
        lines.append(f"- NIFs found in document: {', '.join(hints.nifs)}")
    if hints.ibans:
        lines.append(f"- IBANs found: {', '.join(hints.ibans)}")
    if hints.dates:
        lines.append(f"- Dates found: {', '.join(hints.dates)}")
    if hints.amounts:
        amounts_str = ", ".join(f"€{a}" for a in hints.amounts[:5])
        lines.append(f"- Amounts found (largest first): {amounts_str}")
    if hints.atcud:
        lines.append(f"- ATCUD found: {hints.atcud}")
    if hints.type_candidates:
        candidates = ", ".join(
            f"{code} ({itype}, conf={conf:.0%})"
            for code, itype, conf in hints.type_candidates[:3]
        )
        lines.append(f"- Document type candidates: {candidates}")

    if hints.qr_data and hints.qr_data.nif_emitter:
        qr = hints.qr_data
        lines.append("- **QR Code Data (high-trust source):**")
        lines.append(f"  - Emitter NIF: {qr.nif_emitter}")
        if qr.nif_recipient:
            if qr.nif_recipient == "999999990":
                lines.append("  - Recipient: Consumidor Final (anonymous)")
            else:
                lines.append(f"  - Recipient NIF: {qr.nif_recipient}")
        if qr.doc_type:
            lines.append(f"  - Document type: {qr.doc_type}")
        if qr.total:
            lines.append(f"  - Total: €{qr.total}")
        if qr.atcud:
            lines.append(f"  - ATCUD: {qr.atcud}")
        lines.append("  - QR data takes PRIORITY over OCR text for NIFs and type")

    return "\n".join(lines)


# -- Verification checklist --

_VERIFICATION_CHECKLIST = """\
## SELF-VERIFICATION CHECKLIST (run before outputting)
1. total = base_amount + vat? If not, re-check amounts
2. supplier_nif ≠ client_nif? If same, keep supplier_nif, set client_nif to "000000000"
3. All NIFs are exactly 9 digits and start with 1-3,5-9? Correct OCR errors if needed
4. date is in ISO YYYY-MM-DD format?
5. type matches one of the allowed values?
6. vat_breakdown rates are valid PT rates (0,4,5,6,9,12,13,16,22,23)?
7. line_items total ≈ sum of individual line totals?"""


# -- Adapter initialization (import triggers registration) --

def _init_adapters() -> None:
    """Import all adapter modules to trigger registration."""
    import app.adapters.banking  # noqa: F401
    import app.adapters.commercial  # noqa: F401
    import app.adapters.credit_debit  # noqa: F401
    import app.adapters.government  # noqa: F401
    import app.adapters.invoice  # noqa: F401
    import app.adapters.payroll  # noqa: F401
    import app.adapters.receipt  # noqa: F401
    import app.adapters.transport  # noqa: F401


_init_adapters()
