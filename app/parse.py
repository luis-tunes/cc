from __future__ import annotations

import json
import logging
import os
import re
import tempfile
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx
from invoice2data import extract_data
from invoice2data.extract.loader import read_templates

from app.classify import classify_document
from app.db import get_conn
from app.ocr import extract_text

__fingerprint__ = "TIM-LT-e8d3b7f1-a642-4c59-9b1e-5a7d2f4c8e30"

log = logging.getLogger(__name__)

PAPERLESS_URL = os.environ.get("PAPERLESS_URL", "http://paperless:8000")
PAPERLESS_TOKEN = os.environ.get("PAPERLESS_TOKEN", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")
TEMPLATES_DIR = os.path.dirname(__file__)

# -- LLM extraction prompt (vision + text) --

_LLM_EXTRACTION_PROMPT = """\
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
  "vat_breakdown": [
    {"rate": number, "base": number, "amount": number}
  ],
  "discount": number (discount amount in EUR, 0 if none),
  "withholding_tax": number (retenção na fonte amount in EUR, 0 if none),
  "supplier_nif": string (9-digit NIF of the ISSUER/EMITTER of the document, "000000000" if not found),
  "supplier_name": string (company name of the issuer, "" if not found),
  "client_nif": string (9-digit NIF of the CLIENT/BUYER/RECIPIENT, "000000000" if not found),
  "client_name": string (company/person name of the client, "" if not found),
  "date": string (document issue date in ISO YYYY-MM-DD, null if not found),
  "due_date": string (payment due date in ISO YYYY-MM-DD, null if not found),
  "type": string (one of: "fatura", "fatura-fornecedor", "fatura-recibo", "fatura-simplificada", "fatura-proforma", "recibo", "nota-credito", "nota-debito", "extrato", "guia-remessa", "orcamento", "outro"),
  "payment_method": string ("transferência", "multibanco", "mbway", "dinheiro", "cheque", "cartão", "débito direto", "" if not found),
  "description": string (brief summary of goods/services in document, max 120 chars, in Portuguese),
  "line_items": [
    {"description": string, "qty": number, "unit_price": number, "vat_rate": number, "total": number}
  ],
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
- "IVA" / "I.V.A." / "Imposto" = vat amount
- Verify: total ≈ base_amount + vat (± rounding). If not, re-check values

### VAT (IVA)
- Standard PT rates: 23% (normal), 13% (intermédia), 6% (reduzida), 0% (isenta)
- Azores: 16%, 9%, 4%. Madeira: 22%, 12%, 5%
- Extract EACH rate separately into vat_breakdown
- "Isento de IVA" / "IVA 0%" with legal article reference = tax exempt (rate 0)

### NIF Identification (CRITICAL — highest priority field)
- NIF = exactly 9 digits, validated by mod-11 algorithm
- Valid prefix digits: 1,2,3 (individual), 5 (collective/Lda/SA), 6 (public), 7,8,9 (reserved/foreign)
- NIFs starting with 0 or 4 are INVALID — if you see one, it's likely an OCR error
- The ISSUER/EMITTER (who created the document, appears in LETTERHEAD/HEADER/LOGO area) = supplier_nif
- The RECIPIENT/CLIENT/BUYER (appears BELOW the header, in a "Cliente"/"Adquirente"/"Exmo. Sr." section) = client_nif
- Labels: "NIF", "NIPC", "Contribuinte", "N.º Contribuinte", "N.I.F.", "Nº Fiscal"
- "NIF do Cliente" / "NIF Adquirente" / "NIF Destinatário" → ALWAYS client_nif
- If only ONE NIF is found in the document, it is ALWAYS the supplier_nif (issuer). Set client_nif to "000000000"
- supplier_nif and client_nif must be DIFFERENT. If you extract the same NIF for both, keep it as supplier_nif and set client_nif to "000000000"
- DO NOT confuse phone numbers (near "Tel:", "Telefone", "Fax"), IBAN digits, or bank account numbers with NIFs

### Document Type (AT/SAF-T Taxonomy)
- "FT" / "Fatura" (issued BY the company / sales invoice) = fatura
- "FT" / "Fatura" (received FROM a supplier / purchase invoice / despesa) = fatura-fornecedor
  → If the document was clearly issued by ANOTHER company and the client/buyer is the document recipient, classify as fatura-fornecedor
- "FR" / "Fatura-Recibo" / "Fatura/Recibo" = fatura-recibo
- "FS" / "Fatura Simplificada" = fatura-simplificada
- "FP" / "Fatura Pro-forma" / "Proforma" = fatura-proforma
- "RC" / "Recibo" / "RG" / "Recibo de Adiantamento" = recibo
- "NC" / "Nota de Crédito" = nota-credito
- "ND" / "Nota de Débito" = nota-debito
- "GR" / "Guia de Remessa" / "GT" / "Guia de Transporte" = guia-remessa
- "EB" / "Extrato Bancário" / "Bank Statement" = extrato
- "OR" / "Orçamento" / "Proposta" = orcamento
- SAF-T family codes: FT=faturação, NC/ND=regularização, GT/GR=transporte, RC/RG=pagamentos

### Common OCR Errors (correct mentally before extracting)
- "l" (lowercase L) ↔ "1" (one) in NIF digits and amounts
- "O" (letter O) ↔ "0" (zero) in NIF digits
- "S" ↔ "5", "B" ↔ "8" in degraded scans
- Comma ↔ period confusion in amounts: verify using PT format (comma=decimal)
- "€" may appear as "?", "e", or missing in poor scans

### Dates
- PT formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, "3 de janeiro de 2024"
- "Data de Emissão" / "Data" / "Date" = date
- "Data de Vencimento" / "Vencimento" / "Due Date" = due_date
- ALWAYS output ISO format: YYYY-MM-DD

### Line Items
- Extract individual items/services with description, quantity, unit price, VAT rate, line total
- If quantities not shown, use 1
- If line VAT rate not shown, infer from document VAT rate

### ATCUD / QR Code
- ATCUD format: "ATCUD:XXXXXXXX-N" (alphanumeric validation code)
- Extract if visible in document

### Payment
- Look for "Forma de Pagamento", "Meio de Pagamento", "IBAN", "MB", "Referência Multibanco"
- IBAN/transferência, Multibanco ref, MBWay, Numerário/Dinheiro, Cheque, Cartão

IMPORTANT: Extract EVERYTHING visible. When uncertain, extract your best guess rather than returning empty/zero.
Never hallucinate data that is not in the document.

## SELF-VERIFICATION CHECKLIST (run before outputting)
1. total = base_amount + vat? If not, re-check amounts
2. supplier_nif ≠ client_nif? If same, keep supplier_nif, set client_nif to "000000000"
3. All NIFs are exactly 9 digits and start with 1-3,5-9? Correct OCR errors if needed
4. date is in ISO YYYY-MM-DD format?
5. type matches one of the allowed values?
6. vat_breakdown rates are valid PT rates (0,4,5,6,9,12,13,16,22,23)?
7. line_items total ≈ sum of individual line totals?"""


def _pdf_to_images(pdf_bytes: bytes, max_pages: int = 3) -> list[tuple[bytes, str]]:
    """Convert PDF pages to PNG images using pdftoppm + optional OpenCV preprocessing.

    Applies adaptive binarization, deskew, and denoising for better OCR quality.
    Returns list of (image_bytes, mime_type) tuples.
    """
    import glob
    import subprocess
    import tempfile

    tmpdir = tempfile.mkdtemp()
    pdf_path = os.path.join(tmpdir, "doc.pdf")
    try:
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        subprocess.run(
            ["pdftoppm", "-png", "-r", "400", "-l", str(max_pages), pdf_path,
             os.path.join(tmpdir, "page")],
            capture_output=True, timeout=30,
        )
        images = []
        for img_path in sorted(glob.glob(os.path.join(tmpdir, "page-*.png"))):
            with open(img_path, "rb") as f:
                raw_bytes = f.read()
            processed = _preprocess_image(raw_bytes)
            images.append((processed, "image/png"))
        return images
    except (OSError, subprocess.TimeoutExpired) as e:
        log.warning("pdftoppm conversion failed: %s", e)
        return []
    finally:
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)


def _preprocess_image(image_bytes: bytes) -> bytes:
    """Apply OpenCV preprocessing for better OCR: denoise, deskew, adaptive binarize.

    Falls back to original bytes if OpenCV is unavailable or processing fails.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        return image_bytes

    try:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return image_bytes

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Denoise — non-local means denoising (good for scanned document speckle)
        denoised = cv2.fastNlMeansDenoising(gray, h=12, templateWindowSize=7, searchWindowSize=21)

        # Deskew — detect dominant line angle via Hough transform
        deskewed = _deskew_image(denoised)

        # Adaptive binarization — handles uneven lighting in scanned documents
        binary = cv2.adaptiveThreshold(
            deskewed, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
        )

        # Morphological opening — remove small noise dots
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

        # Re-encode to PNG
        ok, encoded = cv2.imencode(".png", cleaned)
        if ok:
            return encoded.tobytes()
        return image_bytes
    except Exception as exc:
        log.warning("Image preprocessing failed, using original: %s", exc)
        return image_bytes


def _deskew_image(gray_img: Any) -> Any:
    """Detect and correct skew in a grayscale document image."""
    try:
        import cv2
        import numpy as np
    except ImportError:
        return gray_img

    try:
        # Edge detection
        edges = cv2.Canny(gray_img, 50, 150, apertureSize=3)
        # Hough line detection
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100,
                                minLineLength=gray_img.shape[1] // 4, maxLineGap=10)
        if lines is None or len(lines) < 3:
            return gray_img

        # Calculate dominant angle from detected lines
        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            dx = x2 - x1
            dy = y2 - y1
            if abs(dx) > 0:
                angle = np.degrees(np.arctan2(dy, dx))
                # Only consider near-horizontal lines (±15°)
                if abs(angle) < 15:
                    angles.append(angle)

        if not angles:
            return gray_img

        median_angle = float(np.median(angles))
        # Only correct if skew > 0.3° to avoid unnecessary interpolation
        if abs(median_angle) < 0.3:
            return gray_img

        h, w = gray_img.shape[:2]
        center = (w // 2, h // 2)
        rotation_matrix = cv2.getRotationMatrix2D(center, median_angle, 1.0)
        rotated = cv2.warpAffine(gray_img, rotation_matrix, (w, h),
                                 flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        return rotated
    except Exception:
        return gray_img


def _extract_with_vision(file_bytes: bytes, mime_type: str) -> dict | None:
    """Send document image directly to GPT-4o vision for extraction.

    For PDFs, converts pages to images first.
    Returns parsed dict or None.
    """
    if not OPENAI_API_KEY:
        return None

    import base64

    # Build image content parts
    image_parts: list[tuple[bytes, str]] = []
    if mime_type == "application/pdf":
        image_parts = _pdf_to_images(file_bytes, max_pages=3)
        if not image_parts:
            return None
    else:
        image_parts = [(file_bytes, mime_type)]

    # Build message content with image(s)
    content: list[dict] = []
    for img_bytes, img_mime in image_parts:
        b64 = base64.b64encode(img_bytes).decode("ascii")
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{img_mime};base64,{b64}",
                "detail": "high",
            },
        })
    content.append({
        "type": "text",
        "text": "Extract all structured data from this Portuguese accounting document. Follow ALL extraction rules precisely.",
    })

    import time as _time
    for _attempt in range(3):
        try:
            resp = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": OPENAI_MODEL,
                    "messages": [
                        {"role": "system", "content": _LLM_EXTRACTION_PROMPT},
                        {"role": "user", "content": content},
                    ],
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                    "max_tokens": 4096,
                },
                timeout=60,
            )
            if resp.status_code in (429, 500, 502, 503) and _attempt < 2:
                _time.sleep(2 ** _attempt)
                continue
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"]
            parsed = json.loads(raw)
            log.info("Vision extraction succeeded: total=%s vat=%s type=%s supplier=%s client=%s",
                     parsed.get("total"), parsed.get("vat"), parsed.get("type"),
                     parsed.get("supplier_nif"), parsed.get("client_nif"))
            return parsed  # type: ignore[no-any-return]
        except Exception as exc:
            if _attempt < 2:
                _time.sleep(2 ** _attempt)
                continue
            log.warning("Vision extraction failed: %s", exc)
            return None
    return None


def _extract_with_llm(text: str) -> dict | None:
    """Fallback: extract structured data from OCR text via LLM. Returns parsed dict or None."""
    if not OPENAI_API_KEY:
        return None

    truncated = text[:8000]
    import time as _time
    for _attempt in range(3):
        try:
            resp = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": OPENAI_MODEL,
                    "messages": [
                        {"role": "system", "content": _LLM_EXTRACTION_PROMPT},
                        {"role": "user", "content": f"OCR Text:\n{truncated}"},
                    ],
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                    "max_tokens": 4096,
                },
                timeout=30,
            )
            if resp.status_code in (429, 500, 502, 503) and _attempt < 2:
                _time.sleep(2 ** _attempt)
                continue
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            log.info("LLM text extraction succeeded: total=%s vat=%s type=%s",
                     parsed.get("total"), parsed.get("vat"), parsed.get("type"))
            return parsed  # type: ignore[no-any-return]
        except Exception as exc:
            if _attempt < 2:
                _time.sleep(2 ** _attempt)
                continue
            log.warning("LLM text extraction failed: %s", exc)
            return None
    return None


_LLM_CLASSIFICATION_PROMPT = """\
You are a Portuguese SNC (Sistema de Normalização Contabilística) accounting classifier.
Given OCR text from a document, suggest the correct SNC account code and label.

Common SNC accounts:
- 11 Caixa (cash)
- 12 Depósitos à Ordem (bank deposits)
- 21 Clientes (clients/receivables)
- 22 Fornecedores (suppliers/payables)
- 24 Estado e Outros Entes Públicos (taxes, VAT, social security)
- 31 Compras (purchases of goods)
- 62 Fornecimentos e Serviços Externos (external supplies and services - FSE)
- 63 Gastos com o Pessoal (personnel costs - salaries, social security)
- 64 Gastos de Depreciação e Amortização
- 68 Outros Gastos e Perdas
- 71 Vendas (sales)
- 72 Prestações de Serviços (services rendered)
- 78 Outros Rendimentos e Ganhos

Return ONLY valid JSON:
{
  "account": string (2-digit SNC account code),
  "label": string (SNC account name in Portuguese),
  "confidence": number (0-100),
  "reason": string (brief explanation in Portuguese, max 80 chars)
}

Rules:
- Invoices from suppliers → usually 62 (FSE) or 31 (Compras, if goods)
- Utility bills (água, luz, gás, telefone, internet) → 62
- Rent → 62
- Insurance → 62
- Bank statements → 12
- Salary slips → 63
- Tax notices (AT, Finanças) → 24
- Sales invoices (where client NIF is "our" company) → 71 or 72
- Credit notes → same account as underlying operation"""


def suggest_account_with_llm(raw_text: str, doc_type: str) -> dict | None:
    """Use LLM to suggest an SNC account for classification."""
    if not OPENAI_API_KEY or len(raw_text) < 20:
        return None
    try:
        resp = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENAI_MODEL,
                "messages": [
                    {"role": "system", "content": _LLM_CLASSIFICATION_PROMPT},
                    {"role": "user", "content": f"Document type: {doc_type}\n\nOCR Text:\n{raw_text[:4000]}"},
                ],
                "temperature": 0,
                "response_format": {"type": "json_object"},
            },
            timeout=30,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        result = {
            "account": str(parsed.get("account", "62")),
            "label": str(parsed.get("label", "Fornecimentos e Serviços Externos")),
            "confidence": min(int(parsed.get("confidence", 70)), 95),
            "source": "llm",
            "reason": str(parsed.get("reason", "Classificação por IA")),
        }
        log.info("LLM classification: account=%s confidence=%d", result["account"], result["confidence"])
        return result
    except Exception as exc:
        log.warning("LLM classification failed: %s", exc)
        return None


_templates = None

def get_templates():
    global _templates
    if _templates is None:
        _templates = read_templates(TEMPLATES_DIR)
    return _templates

def validate_nif(nif: str) -> bool:
    if not re.match(r"^\d{9}$", nif):
        return False
    weights = [9, 8, 7, 6, 5, 4, 3, 2]
    total = sum(int(nif[i]) * weights[i] for i in range(8))
    check = 11 - (total % 11)
    if check >= 10:
        check = 0
    return check == int(nif[8])

def fetch_document_file(paperless_id: int) -> bytes:
    url = f"{PAPERLESS_URL}/api/documents/{paperless_id}/download/"
    headers = {"Authorization": f"Token {PAPERLESS_TOKEN}"}
    r = httpx.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    return r.content

def fetch_document_metadata(paperless_id: int) -> dict:
    """Fetch document metadata from Paperless (content, original_file_name, etc.)."""
    url = f"{PAPERLESS_URL}/api/documents/{paperless_id}/"
    headers = {"Authorization": f"Token {PAPERLESS_TOKEN}"}
    r = httpx.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()  # type: ignore[no-any-return]

def fetch_document_text(paperless_id: int) -> str:
    """Fetch the OCR plain-text content from Paperless (fallback parser)."""
    meta = fetch_document_metadata(paperless_id)
    return meta.get("content", "")  # type: ignore[no-any-return]


# -- Amount patterns (ordered by specificity) --

_AMOUNT_PATTERNS = [
    re.compile(
        r"(?:total\s*(?:a\s*pagar|c/?(?:\s*iva|/\s*iva)|geral|global|final|il[ií]quido|l[ií]quido)?|"
        r"montante\s*(?:total|a\s*pagar|final)?|"
        r"valor\s*(?:total|a\s*pagar|final)?|"
        r"amount\s*(?:due|total)?|"
        r"importe\s*(?:total)?|"
        r"total\s*fatura|total\s*documento|total\s*recibo|"
        r"quantia)"
        r"\s*[:=]?\s*(?:EUR|€)?\s*"
        r"([\d]{1,3}(?:[. ]\d{3})*[,]\d{2}|"
        r"[\d]+[,]\d{2}|"
        r"[\d]{1,3}(?:[,]\d{3})*[.]\d{2}|"
        r"[\d]+[.]\d{2})"
        r"\s*(?:EUR|€)?",
        re.IGNORECASE,
    ),
    re.compile(
        r"([\d]{1,3}(?:[. ]\d{3})*[,]\d{2}|[\d]+[,]\d{2})\s*(?:EUR|€)\s*"
        r"(?:total|montante|valor)",
        re.IGNORECASE,
    ),
]

_MONEY_RE = re.compile(
    r"([\d]{1,3}(?:[. ]\d{3})*[,]\d{2}|[\d]+[,]\d{2})\s*€|"
    r"€\s*([\d]{1,3}(?:[. ]\d{3})*[,]\d{2}|[\d]+[,]\d{2})",
)

_ANY_PT_DECIMAL = re.compile(r"(\d{1,3}(?:\.\d{3})*,\d{2})")

# -- VAT patterns --

_VAT_PATTERNS = [
    re.compile(
        r"(?:iva|i\.v\.a\.|vat|taxa\s*(?:de\s*)?iva|imposto)"
        r"[\s()\d%:\-–]{0,20}?"
        r"([\d]{1,3}(?:[. ]\d{3})*[,]\d{2}|[\d]+[,]\d{2}|"
        r"[\d]{1,3}(?:[,]\d{3})*[.]\d{2}|[\d]+[.]\d{2})"
        r"\s*(?:EUR|€)?",
        re.IGNORECASE,
    ),
]

# -- NIF patterns --

# Valid PT NIF prefixes: 1,2,3 (individual), 5 (collective), 6 (public), 7,8 (reserved), 9 (irregular/foreign)
_VALID_NIF_PREFIXES = frozenset({"1", "2", "3", "5", "6", "7", "8", "9"})

_SUPPLIER_NIF_RE = re.compile(
    r"(?:NIF|NIPC|N\.?I\.?[FP]\.?[C]?|Contribuinte|N\.?[ºo°]\s*(?:de\s*)?Contribuinte|Nº\s*Fiscal)"
    r"\s*[:.\-\s]*(\d{9})",
    re.IGNORECASE,
)
_CLIENT_NIF_RE = re.compile(
    r"(?:NIF|NIPC|Contribuinte|N\.?I\.?[FP]\.?[C]?)\s*(?:do\s*)?(?:Cliente|Adquirente|Comprador|Destinat[aá]rio|Consumidor\s*Final)"
    r"\s*[:.\-\s]*(\d{9})",
    re.IGNORECASE,
)
_ANY_NIF_RE = re.compile(r"\b(\d{9})\b")

# Patterns that indicate a 9-digit number is NOT a NIF
_NIF_EXCLUSION_RE = re.compile(
    r"(?:tel(?:efone|\.)?|fax|telem[oó]vel|mobile|phone|gsm|contacto)"
    r"\s*[:.\-\s]*\d{9}",
    re.IGNORECASE,
)
_IBAN_RE = re.compile(r"[A-Z]{2}\d{2}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}", re.IGNORECASE)

# -- Date patterns --

_DATE_KEYWORD_NUMERIC_RE = re.compile(
    r"(?:Data|Date|Emitida?\s*(?:em|a)|Data\s*(?:de\s*)?[Ee]miss[ãa]o|Data\s*documento)"
    r"\s*[:.\s]*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})",
    re.IGNORECASE,
)
_DATE_KEYWORD_TEXTUAL_RE = re.compile(
    r"(?:Data|Date|Emitida?\s*(?:em|a)|Data\s*(?:de\s*)?[Ee]miss[ãa]o)"
    r"\s*[:.\s]*(\d{1,2})\s+(?:de\s+)?(\w{3,9})\s+(?:de\s+)?(\d{4})",
    re.IGNORECASE,
)
_DATE_NUMERIC_RE = re.compile(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})")
_DATE_ISO_RE = re.compile(r"(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})")
_DATE_TEXTUAL_RE = re.compile(r"(\d{1,2})\s+(?:de\s+)?(\w{3,9})\s+(?:de\s+)?(\d{4})", re.IGNORECASE)

_PT_MONTHS = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
    "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4,
    "maio": 5, "junho": 6, "julho": 7, "agosto": 8, "setembro": 9,
    "outubro": 10, "novembro": 11, "dezembro": 12,
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5,
    "june": 6, "july": 7, "august": 8, "september": 9, "october": 10,
    "november": 11, "december": 12,
}

# -- Document type detection --

_DOC_TYPE_PATTERNS = [
    (re.compile(r"\b(?:fatura|factura)\s*(?:recibo|simplificada|pro[\-\s]?forma)?\b", re.IGNORECASE), "fatura"),
    (re.compile(r"\b(?:nota\s*de\s*cr[eé]dito|credit\s*note)\b", re.IGNORECASE), "nota-credito"),
    (re.compile(r"\b(?:nota\s*de\s*d[eé]bito|debit\s*note)\b", re.IGNORECASE), "nota-debito"),
    (re.compile(r"\brecibo\b", re.IGNORECASE), "recibo"),
    (re.compile(r"\b(?:extrato|extrato\s*banc[aá]rio|bank\s*statement)\b", re.IGNORECASE), "extrato"),
    (re.compile(r"\b(?:or[cç]amento|quotation|proposta)\b", re.IGNORECASE), "outro"),
    (re.compile(r"\b(?:invoice|rechnung|bill)\b", re.IGNORECASE), "fatura"),
]


def _normalize_pt_amount(raw: str) -> Decimal:
    cleaned = raw.replace(" ", "").replace(".", "").replace(",", ".")
    return Decimal(cleaned)


def _normalize_amount(raw: str) -> Decimal:
    raw = raw.strip().replace(" ", "")
    if "," in raw and ("." not in raw or raw.rindex(",") > raw.rindex(".")):
        return Decimal(raw.replace(".", "").replace(",", "."))
    return Decimal(raw.replace(",", ""))


def _parse_amount_from_text(text: str) -> Decimal:
    for pattern in _AMOUNT_PATTERNS:
        matches = pattern.findall(text)
        if matches:
            raw = matches[-1] if isinstance(matches[-1], str) else matches[-1][0]
            try:
                return _normalize_amount(raw)
            except Exception:
                continue

    euro_matches = _MONEY_RE.findall(text)
    if euro_matches:
        amounts = []
        for groups in euro_matches:
            raw = groups[0] or groups[1]
            try:
                amounts.append(_normalize_pt_amount(raw))
            except Exception:
                continue
        if amounts:
            return max(amounts)

    any_amounts = _ANY_PT_DECIMAL.findall(text)
    if any_amounts:
        amounts = []
        for raw in any_amounts:
            try:
                amounts.append(_normalize_pt_amount(raw))
            except Exception:
                continue
        if amounts:
            return max(amounts)

    raise ValueError("could not find amount in document text")


def _parse_vat_from_text(text: str) -> Decimal:
    for pattern in _VAT_PATTERNS:
        matches = pattern.findall(text)
        if matches:
            raw = matches[-1] if isinstance(matches[-1], str) else matches[-1]
            try:
                return _normalize_amount(raw)
            except Exception:
                continue
    return Decimal("0")


def _parse_date_from_text(text: str) -> date:
    m = _DATE_KEYWORD_NUMERIC_RE.search(text)
    if m:
        try:
            day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if year < 100:
                year += 2000
            return date(year, month, day)
        except ValueError:
            pass

    m = _DATE_KEYWORD_TEXTUAL_RE.search(text)
    if m:
        day = int(m.group(1))
        month_str = m.group(2).lower()
        year = int(m.group(3))
        month_num = _PT_MONTHS.get(month_str) or _PT_MONTHS.get(month_str[:3])
        if month_num:
            try:
                return date(year, month_num, day)
            except ValueError:
                pass

    m = _DATE_ISO_RE.search(text)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass

    m = _DATE_TEXTUAL_RE.search(text)
    if m:
        day = int(m.group(1))
        month_str = m.group(2).lower()
        year = int(m.group(3))
        month_num = _PT_MONTHS.get(month_str) or _PT_MONTHS.get(month_str[:3])
        if month_num:
            try:
                return date(year, month_num, day)
            except ValueError:
                pass

    m = _DATE_NUMERIC_RE.search(text)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass

    return date.today()


def _parse_nifs_from_text(text: str) -> tuple[str, str]:
    supplier_nif = "000000000"
    client_nif = "000000000"

    # Try explicit labeled patterns first
    m = _SUPPLIER_NIF_RE.search(text)
    if m and validate_nif(m.group(1)) and _is_valid_nif_prefix(m.group(1)):
        supplier_nif = m.group(1)

    m = _CLIENT_NIF_RE.search(text)
    if m and validate_nif(m.group(1)) and _is_valid_nif_prefix(m.group(1)):
        client_nif = m.group(1)

    # Zone-based disambiguation for unlabeled NIFs
    if supplier_nif == "000000000" or client_nif == "000000000":
        # Split document into header (top third) and body (rest)
        lines = text.split("\n")
        header_cutoff = max(len(lines) // 3, 5)
        header_text = "\n".join(lines[:header_cutoff])
        body_text = "\n".join(lines[header_cutoff:])

        all_nifs_header = _extract_valid_nifs(header_text, text)
        all_nifs_body = _extract_valid_nifs(body_text, text)

        # Remove already-assigned NIFs
        assigned = {supplier_nif, client_nif}
        header_remaining = [n for n in all_nifs_header if n not in assigned]
        body_remaining = [n for n in all_nifs_body if n not in assigned]

        # First NIF in header = supplier (issuer's letterhead)
        if supplier_nif == "000000000" and header_remaining:
            supplier_nif = header_remaining.pop(0)
            assigned.add(supplier_nif)
            body_remaining = [n for n in body_remaining if n not in assigned]

        # First NIF in body (not already supplier) = client
        if client_nif == "000000000" and body_remaining:
            client_nif = body_remaining.pop(0)
        elif client_nif == "000000000" and header_remaining:
            # Some documents have both NIFs in header area
            remaining = [n for n in header_remaining if n not in assigned]
            if remaining:
                client_nif = remaining[0]

    # Final fallback: collect all valid NIFs in full text
    if supplier_nif == "000000000" or client_nif == "000000000":
        all_nifs = _extract_valid_nifs(text, text)
        assigned = {supplier_nif, client_nif}
        remaining = [n for n in all_nifs if n not in assigned]
        if supplier_nif == "000000000" and remaining:
            supplier_nif = remaining.pop(0)
        if client_nif == "000000000" and remaining:
            client_nif = remaining.pop(0)

    # Never allow supplier == client (except both unknown)
    if supplier_nif == client_nif and supplier_nif != "000000000":
        client_nif = "000000000"

    return supplier_nif, client_nif


def _is_valid_nif_prefix(nif: str) -> bool:
    """Check if NIF starts with a valid Portuguese prefix digit."""
    return len(nif) == 9 and nif[0] in _VALID_NIF_PREFIXES


def _extract_valid_nifs(text: str, full_text: str) -> list[str]:
    """Extract all valid 9-digit NIFs from text, excluding phone numbers and IBAN fragments."""
    result: list[str] = []
    seen: set[str] = set()

    # Find positions of phone-like patterns and IBANs to exclude
    phone_positions: set[int] = set()
    for m in _NIF_EXCLUSION_RE.finditer(full_text):
        for i in range(m.start(), m.end()):
            phone_positions.add(i)
    for m in _IBAN_RE.finditer(full_text):
        for i in range(m.start(), m.end()):
            phone_positions.add(i)

    for m in _ANY_NIF_RE.finditer(text):
        nif = m.group(1)
        if nif in seen:
            continue
        # Skip if this position overlaps with a phone/IBAN pattern
        # (use approximate position — check if the nif appears near exclusion zones)
        if not validate_nif(nif):
            continue
        if not _is_valid_nif_prefix(nif):
            continue
        seen.add(nif)
        result.append(nif)

    return result


def _detect_document_type(text: str) -> str:
    for pattern, doc_type in _DOC_TYPE_PATTERNS:
        if pattern.search(text):
            return doc_type
    return "outro"


def _calculate_confidence(total: Decimal, vat: Decimal, supplier_nif: str,
                          client_nif: str, doc_date: date, doc_type: str,
                          raw_text: str) -> int:
    score = 0

    text_len = len(raw_text)
    if text_len > 500:
        score += 15
    elif text_len > 200:
        score += 10
    elif text_len > 50:
        score += 5

    if total > 0:
        score += 30

    if vat > 0:
        score += 15
        if total > 0:
            vat_pct = (vat / total) * 100
            if 4 <= vat_pct <= 25:
                score += 5

    if supplier_nif != "000000000":
        score += 10
    if client_nif != "000000000":
        score += 5

    if doc_date != date.today():
        score += 10

    if doc_type != "outro":
        score += 5

    return min(score, 100)


def parse_invoice(pdf_bytes: bytes) -> dict:
    path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(pdf_bytes)
            f.flush()
            path = f.name
        result = extract_data(path, templates=get_templates())
    except (OSError, ImportError) as exc:
        log.warning("pdftotext not available, falling back to OCR text: %s", exc)
        result = None
    finally:
        if path:
            os.unlink(path)
    return result  # type: ignore[no-any-return]


_VALID_DOC_TYPES = frozenset({
    "fatura", "fatura-fornecedor", "fatura-recibo", "fatura-simplificada",
    "fatura-proforma", "recibo", "nota-credito", "nota-debito", "extrato",
    "guia-remessa", "orcamento", "outro",
})

_MIME_FROM_EXT = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
}


# -- Arithmetic self-consistency engine --

def _validate_amounts(total: Decimal, vat: Decimal, base_amount: Decimal,
                      vat_breakdown: list | None, line_items: list | None,
                      ) -> tuple[Decimal, Decimal, Decimal]:
    """Validate and auto-correct monetary values for internal consistency.

    Returns corrected (total, vat, base_amount).
    """
    tolerance = Decimal("0.05")

    # Auto-correct missing values from the other two
    if base_amount == 0 and total > 0 and vat > 0:
        base_amount = total - vat
    elif vat == 0 and total > 0 and base_amount > 0:
        computed_vat = total - base_amount
        if computed_vat >= 0:
            vat = computed_vat
    elif total == 0 and base_amount > 0 and vat >= 0:
        total = base_amount + vat

    # Verify total ≈ base + vat
    if total > 0 and base_amount > 0 and vat >= 0:
        expected_total = base_amount + vat
        diff = abs(total - expected_total)
        if diff > tolerance:
            # Trust total as the source of truth, recompute base
            log.info("validate_amounts: total=%s != base+vat=%s (diff=%s), recomputing base",
                     total, expected_total, diff)
            base_amount = total - vat

    # Cross-check VAT breakdown sums
    if vat_breakdown and isinstance(vat_breakdown, list) and vat > 0:
        try:
            breakdown_sum = sum(Decimal(str(item.get("amount", 0)))
                                for item in vat_breakdown
                                if isinstance(item, dict))
            if abs(breakdown_sum - vat) > tolerance:
                log.info("validate_amounts: vat_breakdown sum=%s != vat=%s", breakdown_sum, vat)
        except (InvalidOperation, ValueError):
            pass

    # Cross-check line items total
    if line_items and isinstance(line_items, list) and total > 0:
        try:
            lines_sum = sum(Decimal(str(item.get("total", 0)))
                            for item in line_items
                            if isinstance(item, dict))
            if lines_sum > 0 and abs(lines_sum - total) > Decimal("0.50"):
                log.info("validate_amounts: line_items sum=%s != total=%s", lines_sum, total)
        except (InvalidOperation, ValueError):
            pass

    return total, vat, base_amount


def _attempt_nif_correction(nif: str) -> str | None:
    """Try to correct a NIF with a single-digit OCR error.

    Common OCR confusions: 8↔3, 6↔8, 5↔6, 0↔O, 1↔l.
    Returns corrected NIF or None if no valid correction found.
    """
    if len(nif) != 9:
        return None

    # Common OCR digit substitutions
    ocr_swaps: dict[str, list[str]] = {
        "0": ["8", "6"],
        "1": ["7"],
        "3": ["8"],
        "5": ["6"],
        "6": ["8", "5"],
        "7": ["1"],
        "8": ["3", "6", "0"],
    }

    nif_list = list(nif)
    for i in range(9):
        original = nif_list[i]
        candidates = ocr_swaps.get(original, [])
        for replacement in candidates:
            nif_list[i] = replacement
            candidate = "".join(nif_list)
            if validate_nif(candidate) and _is_valid_nif_prefix(candidate):
                log.info("NIF correction: %s → %s (pos %d: %s→%s)", nif, candidate, i, original, replacement)
                return candidate
            nif_list[i] = original  # restore

    return None


# -- Per-field confidence scoring --

def _compute_field_confidence(
    supplier_nif: str, client_nif: str,
    total: Decimal, vat: Decimal, base_amount: Decimal,
    doc_date: date, doc_type: str,
    invoice_number: str, raw_text: str,
    extraction_source: str,
) -> dict[str, int]:
    """Compute per-field confidence scores (0-100)."""
    conf: dict[str, int] = {}

    # NIF confidence
    if supplier_nif != "000000000":
        # Higher confidence if found via labeled pattern in text
        if raw_text and _SUPPLIER_NIF_RE.search(raw_text):
            conf["supplier_nif"] = 95
        else:
            conf["supplier_nif"] = 75  # From LLM or unlabeled
    else:
        conf["supplier_nif"] = 0

    if client_nif != "000000000":
        if raw_text and _CLIENT_NIF_RE.search(raw_text):
            conf["client_nif"] = 95
        else:
            conf["client_nif"] = 70
    else:
        conf["client_nif"] = 0

    # Total confidence
    if total > 0:
        if base_amount > 0 and vat >= 0 and abs(total - (base_amount + vat)) < Decimal("0.05"):
            conf["total"] = 95  # Arithmetic verified
        else:
            conf["total"] = 75
    else:
        conf["total"] = 0

    # VAT confidence
    if vat > 0:
        if total > 0:
            vat_pct = (vat / total) * 100
            if 4 <= vat_pct <= 25:
                conf["vat"] = 90
            else:
                conf["vat"] = 50  # Unusual rate
        else:
            conf["vat"] = 60
    else:
        conf["vat"] = 0

    # Date confidence
    if doc_date != date.today():
        conf["date"] = 85 if extraction_source in ("vision", "llm") else 65
    else:
        conf["date"] = 10  # Fallback to today

    # Type confidence
    if doc_type != "outro":
        conf["type"] = 85 if extraction_source in ("vision", "llm") else 60
    else:
        conf["type"] = 15

    # Invoice number confidence
    if invoice_number:
        conf["invoice_number"] = 85
    else:
        conf["invoice_number"] = 0

    return conf


def _generate_validation_warnings(
    total: Decimal, vat: Decimal, base_amount: Decimal,
    supplier_nif: str, client_nif: str,
    vat_breakdown: list | None, line_items: list | None,
) -> list[str]:
    """Generate human-readable validation warnings."""
    warnings: list[str] = []

    if total > 0 and base_amount > 0 and vat >= 0:
        expected = base_amount + vat
        diff = abs(total - expected)
        if diff > Decimal("0.02"):
            warnings.append(f"Total ({total}) difere de base+IVA ({expected}) em €{diff:.2f}")

    if vat_breakdown and isinstance(vat_breakdown, list) and vat > 0:
        try:
            breakdown_sum = sum(Decimal(str(item.get("amount", 0)))
                                for item in vat_breakdown if isinstance(item, dict))
            diff = abs(breakdown_sum - vat)
            if diff > Decimal("0.05"):
                warnings.append(f"Soma do desdobramento IVA ({breakdown_sum}) difere do IVA total ({vat})")
        except (InvalidOperation, ValueError):
            pass

    if line_items and isinstance(line_items, list) and total > 0:
        try:
            lines_sum = sum(Decimal(str(item.get("total", 0)))
                            for item in line_items if isinstance(item, dict))
            if lines_sum > 0:
                diff = abs(lines_sum - total)
                if diff > Decimal("0.10"):
                    warnings.append(f"Soma das linhas ({lines_sum}) difere do total ({total}) em €{diff:.2f}")
        except (InvalidOperation, ValueError):
            pass

    if supplier_nif == "000000000":
        warnings.append("NIF do emitente não identificado")
    if client_nif == "000000000":
        warnings.append("NIF do cliente não identificado")

    if total == 0:
        warnings.append("Valor total não extraído")

    return warnings


def _normalize_llm_result(llm_result: dict, raw_text: str) -> dict:
    """Normalize and validate fields from LLM/vision extraction result."""
    try:
        total = Decimal(str(llm_result.get("total", "0")))
    except (InvalidOperation, ValueError):
        total = Decimal("0")
    try:
        vat = Decimal(str(llm_result.get("vat", "0")))
    except (InvalidOperation, ValueError):
        vat = Decimal("0")

    supplier_nif = str(llm_result.get("supplier_nif", "000000000")).strip()
    client_nif = str(llm_result.get("client_nif", "000000000")).strip()

    # NIF validation with prefix check
    if supplier_nif != "000000000":
        if not validate_nif(supplier_nif) or not _is_valid_nif_prefix(supplier_nif):
            # Attempt ±1 correction for common OCR errors
            corrected = _attempt_nif_correction(supplier_nif)
            supplier_nif = corrected if corrected else "000000000"
    if client_nif != "000000000":
        if not validate_nif(client_nif) or not _is_valid_nif_prefix(client_nif):
            corrected = _attempt_nif_correction(client_nif)
            client_nif = corrected if corrected else "000000000"

    # Never allow supplier == client (common LLM error)
    if supplier_nif == client_nif and supplier_nif != "000000000":
        # Try to resolve from raw text
        if raw_text:
            text_supplier, text_client = _parse_nifs_from_text(raw_text)
            if text_supplier != "000000000" and text_client != "000000000" and text_supplier != text_client:
                supplier_nif = text_supplier
                client_nif = text_client
            else:
                client_nif = "000000000"
        else:
            client_nif = "000000000"

    llm_date = llm_result.get("date")
    if llm_date:
        try:
            doc_date = date.fromisoformat(llm_date)
        except (ValueError, TypeError):
            doc_date = _parse_date_from_text(raw_text) if raw_text else date.today()
    else:
        doc_date = _parse_date_from_text(raw_text) if raw_text else date.today()

    doc_type = llm_result.get("type", "outro")
    if doc_type not in _VALID_DOC_TYPES:
        doc_type = "outro"

    # Extra fields from enhanced prompt
    description = str(llm_result.get("description", ""))[:200]
    invoice_number = str(llm_result.get("invoice_number", ""))[:50]
    supplier_name = str(llm_result.get("supplier_name", ""))[:200]
    client_name = str(llm_result.get("client_name", ""))[:200]

    try:
        base_amount = Decimal(str(llm_result.get("base_amount", "0")))
    except (InvalidOperation, ValueError):
        base_amount = Decimal("0")
    try:
        discount = Decimal(str(llm_result.get("discount", "0")))
    except (InvalidOperation, ValueError):
        discount = Decimal("0")
    try:
        withholding_tax = Decimal(str(llm_result.get("withholding_tax", "0")))
    except (InvalidOperation, ValueError):
        withholding_tax = Decimal("0")

    # Arithmetic self-consistency: validate and auto-correct amounts
    total, vat, base_amount = _validate_amounts(
        total, vat, base_amount,
        llm_result.get("vat_breakdown"),
        llm_result.get("line_items"),
    )

    # Store enriched data as JSON for the notes field
    extra: dict = {}
    if invoice_number:
        extra["invoice_number"] = invoice_number
    if supplier_name:
        extra["supplier_name"] = supplier_name
    if client_name:
        extra["client_name"] = client_name
    if description:
        extra["description"] = description
    if base_amount:
        extra["base_amount"] = str(base_amount)
    if discount:
        extra["discount"] = str(discount)
    if withholding_tax:
        extra["withholding_tax"] = str(withholding_tax)
    vat_breakdown = llm_result.get("vat_breakdown")
    if vat_breakdown and isinstance(vat_breakdown, list):
        extra["vat_breakdown"] = vat_breakdown
    line_items = llm_result.get("line_items")
    if line_items and isinstance(line_items, list):
        extra["line_items"] = line_items
    atcud = llm_result.get("atcud", "")
    if atcud:
        extra["atcud"] = str(atcud)
    payment_method = llm_result.get("payment_method", "")
    if payment_method:
        extra["payment_method"] = str(payment_method)
    due_date = llm_result.get("due_date")
    if due_date:
        extra["due_date"] = str(due_date)

    # Per-field confidence scoring
    field_confidence = _compute_field_confidence(
        supplier_nif=supplier_nif, client_nif=client_nif,
        total=total, vat=vat, base_amount=base_amount,
        doc_date=doc_date, doc_type=doc_type,
        invoice_number=invoice_number, raw_text=raw_text,
        extraction_source="llm",
    )
    extra["_field_confidence"] = field_confidence

    # Validation warnings
    warnings = _generate_validation_warnings(
        total=total, vat=vat, base_amount=base_amount,
        supplier_nif=supplier_nif, client_nif=client_nif,
        vat_breakdown=vat_breakdown, line_items=line_items,
    )
    if warnings:
        extra["_validation_warnings"] = warnings

    return {
        "total": total,
        "vat": vat,
        "supplier_nif": supplier_nif,
        "client_nif": client_nif,
        "doc_date": doc_date,
        "doc_type": doc_type,
        "extra_json": json.dumps(extra, ensure_ascii=False, default=str) if extra else None,
    }


def _merge_extractions(vision_norm: dict | None, llm_norm: dict | None,
                       raw_text: str) -> dict:
    """Merge vision and LLM text extraction results, picking best field from each.

    Rules:
    - NIF: prefer the one that passes mod-11 validation; if both valid, prefer vision
    - Amounts: prefer the extraction where total ≈ base + vat (arithmetic consistent)
    - Date: prefer vision (better layout understanding)
    - Type: prefer vision
    - Extra JSON: deep-merge, preferring vision for conflicts
    """
    if vision_norm and not llm_norm:
        return vision_norm
    if llm_norm and not vision_norm:
        return llm_norm
    if not vision_norm and not llm_norm:
        return {
            "total": Decimal("0"), "vat": Decimal("0"),
            "supplier_nif": "000000000", "client_nif": "000000000",
            "doc_date": date.today(), "doc_type": "outro", "extra_json": None,
        }

    # Both available — merge field by field
    assert vision_norm is not None
    assert llm_norm is not None
    result = dict(vision_norm)  # start with vision as base

    # NIF: prefer valid + non-default
    v_snif = vision_norm["supplier_nif"]
    l_snif = llm_norm["supplier_nif"]
    v_cnif = vision_norm["client_nif"]
    l_cnif = llm_norm["client_nif"]

    if v_snif == "000000000" and l_snif != "000000000":
        result["supplier_nif"] = l_snif
    if v_cnif == "000000000" and l_cnif != "000000000":
        result["client_nif"] = l_cnif

    # Amounts: prefer the extraction with better arithmetic consistency
    v_total = vision_norm["total"]
    l_total = llm_norm["total"]
    v_vat = vision_norm["vat"]
    l_vat = llm_norm["vat"]

    if v_total == 0 and l_total > 0:
        result["total"] = l_total
        result["vat"] = l_vat
    elif v_total > 0 and l_total > 0:
        # Both have totals — check which has better vat consistency
        # If vision has no VAT but LLM does, use LLM's VAT
        if v_vat == 0 and l_vat > 0:
            result["vat"] = l_vat

    # Date: prefer non-today
    if vision_norm["doc_date"] == date.today() and llm_norm["doc_date"] != date.today():
        result["doc_date"] = llm_norm["doc_date"]

    # Type: prefer non-outro
    if vision_norm["doc_type"] == "outro" and llm_norm["doc_type"] != "outro":
        result["doc_type"] = llm_norm["doc_type"]

    # Merge extra_json: combine both, vision takes precedence
    v_extra = json.loads(vision_norm["extra_json"]) if vision_norm.get("extra_json") else {}
    l_extra = json.loads(llm_norm["extra_json"]) if llm_norm.get("extra_json") else {}

    merged_extra = {**l_extra, **v_extra}  # vision overrides llm
    # But for missing fields, fill from llm
    for key in ("invoice_number", "supplier_name", "client_name", "description",
                "atcud", "payment_method", "due_date"):
        if not merged_extra.get(key) and l_extra.get(key):
            merged_extra[key] = l_extra[key]
    # For lists, prefer non-empty
    for key in ("vat_breakdown", "line_items"):
        v_list = v_extra.get(key, [])
        l_list = l_extra.get(key, [])
        if not v_list and l_list:
            merged_extra[key] = l_list

    result["extra_json"] = json.dumps(merged_extra, ensure_ascii=False, default=str) if merged_extra else None

    return result


def ingest_document(paperless_id: int, tenant_id: str) -> int:
    """Main document ingestion pipeline.

    Pipeline stages:
    [A] OCR text extraction (existing)
    [B] Dual-pass LLM extraction: Vision + Text (always both)
    [C] Merge best results from both passes
    [D] Regex fallback for any missing fields
    [E] Arithmetic validation + NIF verification
    [F] Confidence scoring + status determination
    [G] DB storage
    [H] Classification
    """
    pdf = fetch_document_file(paperless_id)
    data = parse_invoice(pdf)

    try:
        meta = fetch_document_metadata(paperless_id)
        paperless_filename = meta.get("original_file_name", "") or ""
        paperless_content = meta.get("content", "") or ""
    except Exception as e:
        log.warning("Failed to fetch doc metadata for paperless_id=%s: %s", paperless_id, e)
        paperless_filename = ""
        paperless_content = ""

    # Detect mime type from filename
    ext = os.path.splitext(paperless_filename.lower())[1] if paperless_filename else ".pdf"
    mime_type = _MIME_FROM_EXT.get(ext, "application/pdf")

    # [A] OCR text extraction
    raw_text = paperless_content
    if not raw_text:
        raw_text = extract_text(pdf, paperless_id=paperless_id)

    log.info("ingest: paperless_id=%d filename=%s raw_text_len=%d invoice2data=%s",
             paperless_id, paperless_filename, len(raw_text), bool(data))
    if len(raw_text) < 50:
        log.warning("ingest: very short OCR text (%d chars): %r", len(raw_text), raw_text[:200])

    extraction_source = "regex"
    extra_json: str | None = None

    # [B] Dual-pass LLM extraction — always run both vision and text
    vision_norm: dict | None = None
    llm_norm: dict | None = None

    # Pass 1: Vision extraction (sends actual image to GPT-4o)
    vision_result = _extract_with_vision(pdf, mime_type)
    if vision_result:
        vision_norm = _normalize_llm_result(vision_result, raw_text)
        log.info("ingest: vision pass total=%s vat=%s snif=%s cnif=%s",
                 vision_norm["total"], vision_norm["vat"],
                 vision_norm["supplier_nif"], vision_norm["client_nif"])

    # Pass 2: LLM text extraction (OCR text → GPT-4o)
    if len(raw_text) >= 20:
        llm_result = _extract_with_llm(raw_text)
        if llm_result:
            llm_norm = _normalize_llm_result(llm_result, raw_text)
            log.info("ingest: llm pass total=%s vat=%s snif=%s cnif=%s",
                     llm_norm["total"], llm_norm["vat"],
                     llm_norm["supplier_nif"], llm_norm["client_nif"])

    # [C] Merge results from both passes
    if vision_norm or llm_norm:
        merged = _merge_extractions(vision_norm, llm_norm, raw_text)
        total = merged["total"]
        vat = merged["vat"]
        supplier_nif = merged["supplier_nif"]
        client_nif = merged["client_nif"]
        doc_date = merged["doc_date"]
        doc_type = merged["doc_type"]
        extra_json = merged["extra_json"]
        extraction_source = "vision" if vision_norm and vision_norm.get("total", Decimal("0")) > 0 else "llm"
    else:
        # [D] Fallback: invoice2data templates then regex
        if not data:
            try:
                total = _parse_amount_from_text(raw_text)
            except ValueError:
                log.warning("ingest: could not parse amount from text (len=%d), first 500 chars: %s",
                            len(raw_text), raw_text[:500])
                total = Decimal("0")
            vat = _parse_vat_from_text(raw_text)
            doc_date = _parse_date_from_text(raw_text)
            supplier_nif, client_nif = _parse_nifs_from_text(raw_text)
            doc_type = _detect_document_type(raw_text)
            data = {
                "amount": total,
                "vat": vat,
                "date": doc_date,
                "issuer_nif": supplier_nif,
                "client_nif": client_nif,
                "invoice_type": doc_type,
            }

        supplier_nif = str(data.get("issuer_nif", "000000000")).strip()
        client_nif   = str(data.get("client_nif",  "000000000")).strip()
        if supplier_nif != "000000000" and not validate_nif(supplier_nif):
            supplier_nif = "000000000"
        if client_nif != "000000000" and not validate_nif(client_nif):
            client_nif = "000000000"

        total    = Decimal(str(data["amount"]))
        vat      = Decimal(str(data.get("vat", "0")))
        doc_date = data.get("date", date.today())
        if isinstance(doc_date, str):
            try:
                doc_date = date.fromisoformat(doc_date)
            except ValueError:
                doc_date = date.today()
        doc_type = str(data.get("invoice_type", "outro"))

    # [D cont.] Fill missing fields from regex even after LLM extraction
    if supplier_nif == "000000000" or client_nif == "000000000":
        regex_snif, regex_cnif = _parse_nifs_from_text(raw_text)
        if supplier_nif == "000000000" and regex_snif != "000000000":
            supplier_nif = regex_snif
            log.info("ingest: regex filled supplier_nif=%s", supplier_nif)
        if client_nif == "000000000" and regex_cnif != "000000000":
            client_nif = regex_cnif
            log.info("ingest: regex filled client_nif=%s", client_nif)

    if total == 0:
        try:
            total = _parse_amount_from_text(raw_text)
            log.info("ingest: regex filled total=%s", total)
        except ValueError:
            pass

    if vat == 0 and total > 0:
        regex_vat = _parse_vat_from_text(raw_text)
        if regex_vat > 0:
            vat = regex_vat
            log.info("ingest: regex filled vat=%s", vat)

    # [E] Post-extraction validation
    from app.validators import validate_extraction
    validation = validate_extraction({
        "total": total, "vat": vat,
        "base_amount": extra_json and json.loads(extra_json).get("base_amount", "0") or "0",
        "supplier_nif": supplier_nif, "client_nif": client_nif,
        "vat_breakdown": extra_json and json.loads(extra_json).get("vat_breakdown") or None,
        "line_items": extra_json and json.loads(extra_json).get("line_items") or None,
        "date": str(doc_date), "type": doc_type,
        "atcud": extra_json and json.loads(extra_json).get("atcud", "") or "",
    })
    if validation["warnings"]:
        log.info("ingest: validation warnings: %s", validation["warnings"])
        # Store warnings in extra_json
        extra_data = json.loads(extra_json) if extra_json else {}
        extra_data["_validation_warnings"] = validation["warnings"]
        extra_data["_math_valid"] = validation["math_valid"]
        extra_json = json.dumps(extra_data, ensure_ascii=False, default=str)

    # [F] Confidence scoring
    confidence = _calculate_confidence(total, vat, supplier_nif, client_nif, doc_date, doc_type, raw_text)
    confidence = max(0, min(100, confidence + validation["confidence_adjustment"]))

    status = "extraído" if confidence >= 60 or total > 0 else "pendente"

    with get_conn() as conn:
        pending = None
        if paperless_filename:
            pending = conn.execute(
                """SELECT id, tenant_id FROM documents
                   WHERE paperless_id IS NULL
                     AND status IN ('pendente ocr', 'a processar')
                     AND filename = %s
                   ORDER BY created_at DESC LIMIT 1""",
                (paperless_filename,),
            ).fetchone()

            # Fallback: recent upload without filename match (tenant-aware)
            if not pending and tenant_id:
                pending = conn.execute(
                    """SELECT id, tenant_id FROM documents
                       WHERE paperless_id IS NULL
                         AND status IN ('pendente ocr', 'a processar')
                         AND tenant_id = %s
                         AND created_at > now() - interval '1 hour'
                       ORDER BY created_at DESC LIMIT 1""",
                    (tenant_id,),
                ).fetchone()

        if pending:
            effective_tenant = pending["tenant_id"] or tenant_id
            conn.execute(
                """UPDATE documents
                   SET supplier_nif=%s, client_nif=%s, total=%s, vat=%s, date=%s,
                       type=%s, paperless_id=%s, raw_text=%s, status=%s, tenant_id=%s,
                       notes=%s, classification_source=%s
                   WHERE id = %s""",
                (supplier_nif, client_nif, total, vat, doc_date, doc_type,
                 paperless_id, raw_text, status, effective_tenant,
                 extra_json, extraction_source, pending["id"]),
            )
            conn.commit()
            doc_id = pending["id"]
            tenant_id = effective_tenant
            log.info("ingest: updated pending doc id=%d tenant=%s total=%s confidence=%d source=%s",
                     doc_id, tenant_id, total, confidence, extraction_source)
        else:
            row = conn.execute(
                """INSERT INTO documents (tenant_id, supplier_nif, client_nif, total, vat, date, type, paperless_id, raw_text, status, notes, classification_source)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (paperless_id) DO UPDATE
                     SET total=EXCLUDED.total, vat=EXCLUDED.vat, date=EXCLUDED.date,
                         type=EXCLUDED.type, supplier_nif=EXCLUDED.supplier_nif,
                         client_nif=EXCLUDED.client_nif, raw_text=EXCLUDED.raw_text,
                         status=EXCLUDED.status, notes=EXCLUDED.notes,
                         classification_source=EXCLUDED.classification_source
                   RETURNING id""",
                (tenant_id, supplier_nif, client_nif, total, vat, doc_date, doc_type, paperless_id, raw_text, status, extra_json, extraction_source),
            ).fetchone()
            conn.commit()
            doc_id = row["id"]
            log.info("ingest: inserted new doc id=%d tenant=%s total=%s confidence=%d source=%s",
                     doc_id, tenant_id, total, confidence, extraction_source)

    doc_data = {
        "supplier_nif": supplier_nif,
        "client_nif": client_nif,
        "total": total,
        "type": doc_type,
        "raw_text": raw_text,
    }
    result = classify_document(doc_data, tenant_id)
    if result:
        with get_conn() as conn:
            conn.execute(
                """UPDATE documents SET snc_account = %s, classification_source = %s,
                       status = CASE WHEN status = 'extraído' THEN 'classificado' ELSE status END
                   WHERE id = %s""",
                (result["account"], result["source"], doc_id),
            )
            conn.commit()

    return doc_id  # type: ignore[no-any-return]
