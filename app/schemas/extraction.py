"""Canonical extraction output schema — Pydantic models with per-field confidence.

Every extracted field carries: value, confidence (0.0-1.0), source state, and
optional evidence_text (the raw snippet from the document that produced the value).

Source states:
  - raw: value as-is from OCR/vision, no transformation
  - normalized: formatting applied (e.g., PT decimal → float)
  - computed: derived from other fields (e.g., base = total - vat)
  - inferred: LLM best guess with no direct textual evidence
"""

from __future__ import annotations

from decimal import Decimal
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

# -- Enums --

class FieldSource(StrEnum):
    raw = "raw"
    normalized = "normalized"
    computed = "computed"
    inferred = "inferred"


class ExtractionOrigin(StrEnum):
    vision = "vision"
    llm = "llm"
    regex = "regex"
    qr = "qr"
    invoice2data = "invoice2data"
    manual = "manual"


class Direction(StrEnum):
    issued_by_user = "issued_by_user"
    received_by_user = "received_by_user"
    internal = "internal"
    unknown = "unknown"


class QRValidationStatus(StrEnum):
    validated = "validated"
    mismatch = "mismatch"
    not_present = "not_present"
    parse_error = "parse_error"


# -- Field wrapper --

class ExtractedField(BaseModel):
    """A single extracted value with provenance metadata."""
    value: Any
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    source: FieldSource = FieldSource.raw
    origin: ExtractionOrigin = ExtractionOrigin.llm
    evidence_text: str | None = None


# -- Sub-models --

class VATBreakdownItem(BaseModel):
    rate: Decimal = Decimal("0")
    base: Decimal = Decimal("0")
    amount: Decimal = Decimal("0")
    rate_source: FieldSource = FieldSource.raw


class LineItem(BaseModel):
    description: str = ""
    qty: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    vat_rate: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    vat_rate_source: FieldSource = FieldSource.raw


class EntityRole(BaseModel):
    """Identified entity (issuer or recipient) with match metadata."""
    nif: str = "000000000"
    name: str = ""
    iban: str | None = None
    match_confidence: float = 0.0
    is_owner: bool = False


class ValidationResult(BaseModel):
    math_valid: bool = True
    nifs_valid: bool = True
    warnings: list[str] = Field(default_factory=list)
    corrections: dict[str, Any] = Field(default_factory=dict)
    confidence_adjustment: int = 0


class QRData(BaseModel):
    """Parsed Portuguese fiscal QR code fields (AT spec)."""
    nif_emitter: str = ""
    nif_recipient: str = ""
    doc_type: str = ""
    doc_number: str = ""
    atcud: str = ""
    date: str = ""
    total: Decimal = Decimal("0")
    vat_total: Decimal = Decimal("0")
    raw_payload: str = ""
    validation_status: QRValidationStatus = QRValidationStatus.not_present


class DeterministicHints(BaseModel):
    """Pre-extracted values from regex/QR before LLM call."""
    nifs: list[str] = Field(default_factory=list)
    ibans: list[str] = Field(default_factory=list)
    dates: list[str] = Field(default_factory=list)
    amounts: list[Decimal] = Field(default_factory=list)
    atcud: str | None = None
    qr_data: QRData | None = None
    type_candidates: list[tuple[str, str, float]] = Field(default_factory=list)


# -- Main extraction model --

class ExtractionResult(BaseModel):
    """Canonical output of the extraction pipeline.

    Flat fields mirror the DB columns. Rich metadata in nested objects.
    """

    # -- Document identification --
    invoice_number: ExtractedField = Field(default_factory=lambda: ExtractedField(value=""))
    doc_type: ExtractedField = Field(default_factory=lambda: ExtractedField(value="outro"))
    saft_code: str | None = None
    direction: Direction = Direction.unknown

    # -- Entities --
    issuer: EntityRole = Field(default_factory=EntityRole)
    recipient: EntityRole = Field(default_factory=EntityRole)

    # -- Amounts --
    total: ExtractedField = Field(default_factory=lambda: ExtractedField(value=Decimal("0")))
    base_amount: ExtractedField = Field(default_factory=lambda: ExtractedField(value=Decimal("0")))
    vat: ExtractedField = Field(default_factory=lambda: ExtractedField(value=Decimal("0")))
    discount: Decimal = Decimal("0")
    withholding_tax: Decimal = Decimal("0")
    currency: str = "EUR"

    # -- VAT breakdown --
    vat_breakdown: list[VATBreakdownItem] = Field(default_factory=list)

    # -- Line items --
    line_items: list[LineItem] = Field(default_factory=list)

    # -- Dates --
    date: ExtractedField = Field(default_factory=lambda: ExtractedField(value=None))
    due_date: str | None = None

    # -- Fiscal --
    atcud: ExtractedField = Field(default_factory=lambda: ExtractedField(value=""))
    payment_method: str = ""
    description: str = ""

    # -- QR code --
    qr_data: QRData | None = None

    # -- Provenance --
    extraction_origin: ExtractionOrigin = ExtractionOrigin.llm
    hints: DeterministicHints | None = None

    # -- Validation --
    validation: ValidationResult = Field(default_factory=ValidationResult)

    # -- Global confidence (0-100 for backwards compat) --
    confidence: int = 0
    field_confidence: dict[str, int] = Field(default_factory=dict)

    def to_flat_dict(self) -> dict[str, Any]:
        """Convert to flat dict matching current DB columns + extra_json."""
        extra: dict[str, Any] = {}
        inv_num = self.invoice_number.value or ""
        if inv_num:
            extra["invoice_number"] = inv_num
        if self.issuer.name:
            extra["supplier_name"] = self.issuer.name
        if self.recipient.name:
            extra["client_name"] = self.recipient.name
        if self.description:
            extra["description"] = self.description
        ba = self.base_amount.value
        if ba:
            extra["base_amount"] = str(ba)
        if self.discount:
            extra["discount"] = str(self.discount)
        if self.withholding_tax:
            extra["withholding_tax"] = str(self.withholding_tax)
        if self.vat_breakdown:
            extra["vat_breakdown"] = [
                {"rate": float(v.rate), "base": float(v.base), "amount": float(v.amount)}
                for v in self.vat_breakdown
            ]
        if self.line_items:
            extra["line_items"] = [
                {
                    "description": li.description,
                    "qty": float(li.qty),
                    "unit_price": float(li.unit_price),
                    "vat_rate": float(li.vat_rate),
                    "total": float(li.total),
                }
                for li in self.line_items
            ]
        atcud_val = self.atcud.value or ""
        if atcud_val:
            extra["atcud"] = atcud_val
        if self.payment_method:
            extra["payment_method"] = self.payment_method
        if self.due_date:
            extra["due_date"] = self.due_date
        if self.field_confidence:
            extra["_field_confidence"] = self.field_confidence
        if self.validation.warnings:
            extra["_validation_warnings"] = self.validation.warnings
        extra["_math_valid"] = self.validation.math_valid
        extra["_direction"] = self.direction.value
        if self.saft_code:
            extra["_saft_code"] = self.saft_code

        import json
        return {
            "total": self.total.value,
            "vat": self.vat.value,
            "supplier_nif": self.issuer.nif,
            "client_nif": self.recipient.nif,
            "doc_date": self.date.value,
            "doc_type": self.doc_type.value,
            "extra_json": json.dumps(extra, ensure_ascii=False, default=str) if extra else None,
        }
