"""Portuguese fiscal QR code parser per AT (Autoridade Tributária) specification.

The fiscal QR code on Portuguese documents encodes structured data in a
pipe-delimited format with single-letter field codes:

  A:123456789*B:999999990*C:PT*D:FT*E:N*F:20240115*...

Key fields:
  A = NIF do emitente (issuer)
  B = NIF do adquirente (recipient) — 999999990 = consumidor final
  C = País (country code, usually PT)
  D = Tipo de documento (FT, FR, FS, NC, ND, RC, etc.)
  E = Estado do documento (N=normal, A=anulado, etc.)
  F = Data do documento (YYYYMMDD)
  G = Identificação do documento (number)
  H = ATCUD
  I = Espaço fiscal (PT, PT-AC, PT-MA)
  N = IVA total
  O = Total do documento
  Q = Hash (4 chars)
  R = Nº do certificado
"""

from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation

from app.schemas.extraction import QRData, QRValidationStatus

log = logging.getLogger(__name__)

# NIF for "Consumidor Final" (anonymous consumer)
CONSUMIDOR_FINAL_NIF = "999999990"


def parse_fiscal_qr(payload: str) -> QRData:
    """Parse a Portuguese fiscal QR code payload string.

    The payload is pipe-delimited: A:123456789*B:999999990*D:FT*...
    Returns a QRData object with extracted fields.
    """
    if not payload or not isinstance(payload, str):
        return QRData(validation_status=QRValidationStatus.not_present)

    fields: dict[str, str] = {}
    try:
        for segment in payload.split("*"):
            if ":" in segment:
                key, _, value = segment.partition(":")
                fields[key.strip().upper()] = value.strip()
    except Exception:
        log.warning("Failed to parse QR payload: %s", payload[:100])
        return QRData(
            raw_payload=payload,
            validation_status=QRValidationStatus.parse_error,
        )

    if not fields:
        return QRData(
            raw_payload=payload,
            validation_status=QRValidationStatus.parse_error,
        )

    # Extract known fields
    nif_emitter = fields.get("A", "")
    nif_recipient = fields.get("B", "")
    doc_type = fields.get("D", "")
    doc_number = fields.get("G", "")
    atcud = fields.get("H", "")
    date_raw = fields.get("F", "")

    # Parse amounts
    total = Decimal("0")
    vat_total = Decimal("0")
    try:
        if "O" in fields:
            total = Decimal(fields["O"].replace(",", "."))
    except (InvalidOperation, ValueError):
        pass
    try:
        if "N" in fields:
            vat_total = Decimal(fields["N"].replace(",", "."))
    except (InvalidOperation, ValueError):
        pass

    # Format date from YYYYMMDD to YYYY-MM-DD
    date_formatted = ""
    if date_raw and len(date_raw) == 8:
        try:
            date_formatted = f"{date_raw[:4]}-{date_raw[4:6]}-{date_raw[6:8]}"
        except Exception:
            date_formatted = date_raw

    return QRData(
        nif_emitter=nif_emitter,
        nif_recipient=nif_recipient,
        doc_type=doc_type,
        doc_number=doc_number,
        atcud=atcud,
        date=date_formatted,
        total=total,
        vat_total=vat_total,
        raw_payload=payload,
        validation_status=QRValidationStatus.validated,
    )


def is_consumidor_final(nif: str) -> bool:
    """Check if NIF represents 'Consumidor Final' (anonymous consumer)."""
    return nif.strip() == CONSUMIDOR_FINAL_NIF


def validate_qr_against_extraction(
    qr: QRData,
    extracted_supplier_nif: str,
    extracted_total: Decimal,
    extracted_type: str,
) -> list[str]:
    """Cross-validate QR data against LLM extraction results.

    Returns list of mismatch warnings.
    """
    warnings: list[str] = []

    if qr.validation_status != QRValidationStatus.validated:
        return warnings

    # NIF emitter check
    if qr.nif_emitter and extracted_supplier_nif != "000000000":
        if qr.nif_emitter != extracted_supplier_nif:
            warnings.append(
                f"QR NIF emitente ({qr.nif_emitter}) ≠ extraído ({extracted_supplier_nif})"
            )

    # Total check (±€0.05 tolerance)
    if qr.total > 0 and extracted_total > 0:
        diff = abs(qr.total - extracted_total)
        if diff > Decimal("0.05"):
            warnings.append(
                f"QR total ({qr.total}) ≠ extraído ({extracted_total}), diferença €{diff:.2f}"
            )

    return warnings
