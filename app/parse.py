import json
import logging
import os
import re
import tempfile
from datetime import date
from decimal import Decimal, InvalidOperation

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
You are an expert Portuguese certified accountant and fiscal document analyst.
Your task: extract ALL structured data from this Portuguese accounting document with maximum precision.

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
  "type": string (one of: "fatura", "fatura-recibo", "fatura-simplificada", "fatura-proforma", "recibo", "nota-credito", "nota-debito", "extrato", "guia-remessa", "orcamento", "outro"),
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

### NIF Identification (CRITICAL)
- NIF = exactly 9 digits, validated by mod-11 algorithm
- The ISSUER/EMITTER (who created the document) = supplier_nif. Usually appears first, in the letterhead/header
- The RECIPIENT/CLIENT/BUYER = client_nif. Usually appears below, under "Cliente", "Adquirente", "Exmo. Sr."
- Labels: "NIF", "NIPC", "Contribuinte", "N.º Contribuinte", "N.I.F.", "Nº Fiscal"
- "NIF do Cliente" / "NIF Adquirente" / "NIF Destinatário" → always client_nif
- If document header shows a company with NIF → that's the supplier
- DO NOT confuse supplier and client NIFs

### Document Type
- "FT" / "Fatura" = fatura
- "FR" / "Fatura-Recibo" / "Fatura/Recibo" = fatura-recibo
- "FS" / "Fatura Simplificada" = fatura-simplificada
- "FP" / "Fatura Pro-forma" / "Proforma" = fatura-proforma
- "RC" / "Recibo" = recibo
- "NC" / "Nota de Crédito" = nota-credito
- "ND" / "Nota de Débito" = nota-debito
- "GR" / "Guia de Remessa" = guia-remessa

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
Never hallucinate data that is not in the document."""


def _pdf_to_images(pdf_bytes: bytes, max_pages: int = 3) -> list[tuple[bytes, str]]:
    """Convert PDF pages to PNG images using pdftoppm (poppler-utils).

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
            ["pdftoppm", "-png", "-r", "300", "-l", str(max_pages), pdf_path,
             os.path.join(tmpdir, "page")],
            capture_output=True, timeout=30,
        )
        images = []
        for img_path in sorted(glob.glob(os.path.join(tmpdir, "page-*.png"))):
            with open(img_path, "rb") as f:
                images.append((f.read(), "image/png"))
        return images
    except (OSError, subprocess.TimeoutExpired) as e:
        log.warning("pdftoppm conversion failed: %s", e)
        return []
    finally:
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)


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

_SUPPLIER_NIF_RE = re.compile(
    r"(?:NIF|NIPC|N\.?I\.?[FP]\.?[C]?|Contribuinte|N\.?[ºo]\s*(?:de\s*)?Contribuinte)"
    r"\s*[:.\s]*(\d{9})",
    re.IGNORECASE,
)
_CLIENT_NIF_RE = re.compile(
    r"(?:NIF|Contribuinte)\s*(?:do\s*)?(?:Cliente|Adquirente|Comprador|Destinat[aá]rio)"
    r"\s*[:.\s]*(\d{9})",
    re.IGNORECASE,
)
_ANY_NIF_RE = re.compile(r"\b(\d{9})\b")

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

    m = _SUPPLIER_NIF_RE.search(text)
    if m and validate_nif(m.group(1)):
        supplier_nif = m.group(1)

    m = _CLIENT_NIF_RE.search(text)
    if m and validate_nif(m.group(1)):
        client_nif = m.group(1)

    if supplier_nif == "000000000" or client_nif == "000000000":
        all_nifs = [n for n in _ANY_NIF_RE.findall(text) if validate_nif(n)]
        seen = set()
        unique_nifs = []
        for n in all_nifs:
            if n not in seen:
                seen.add(n)
                unique_nifs.append(n)
        remaining = [n for n in unique_nifs if n != supplier_nif and n != client_nif]
        if supplier_nif == "000000000" and remaining:
            supplier_nif = remaining.pop(0)
        if client_nif == "000000000" and remaining:
            client_nif = remaining.pop(0)

    return supplier_nif, client_nif


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
    "fatura", "fatura-recibo", "fatura-simplificada", "fatura-proforma",
    "recibo", "nota-credito", "nota-debito", "extrato", "guia-remessa",
    "orcamento", "outro",
})

_MIME_FROM_EXT = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
}


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
    if supplier_nif != "000000000" and not validate_nif(supplier_nif):
        supplier_nif = "000000000"
    if client_nif != "000000000" and not validate_nif(client_nif):
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

    # Store enriched data as JSON for the notes field
    extra = {}
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

    return {
        "total": total,
        "vat": vat,
        "supplier_nif": supplier_nif,
        "client_nif": client_nif,
        "doc_date": doc_date,
        "doc_type": doc_type,
        "extra_json": json.dumps(extra, ensure_ascii=False) if extra else None,
    }


def ingest_document(paperless_id: int, tenant_id: str) -> int:
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

    raw_text = paperless_content
    if not raw_text:
        raw_text = extract_text(pdf, paperless_id=paperless_id)

    log.info("ingest: paperless_id=%d filename=%s raw_text_len=%d invoice2data=%s",
             paperless_id, paperless_filename, len(raw_text), bool(data))
    if len(raw_text) < 50:
        log.warning("ingest: very short OCR text (%d chars): %r", len(raw_text), raw_text[:200])

    extraction_source = "regex"
    extra_json: str | None = None

    # Strategy 1: Vision extraction (best quality — sends actual image to GPT-4o)
    vision_result = _extract_with_vision(pdf, mime_type)
    if vision_result and vision_result.get("total", 0) > 0:
        log.info("ingest: using vision extraction")
        normalized = _normalize_llm_result(vision_result, raw_text)
        total = normalized["total"]
        vat = normalized["vat"]
        supplier_nif = normalized["supplier_nif"]
        client_nif = normalized["client_nif"]
        doc_date = normalized["doc_date"]
        doc_type = normalized["doc_type"]
        extra_json = normalized["extra_json"]
        extraction_source = "vision"
    else:
        # Strategy 2: LLM text extraction (OCR text → GPT-4o)
        llm_result = _extract_with_llm(raw_text) if len(raw_text) >= 20 else None
        if llm_result and llm_result.get("total", 0) > 0:
            log.info("ingest: using LLM text extraction")
            normalized = _normalize_llm_result(llm_result, raw_text)
            total = normalized["total"]
            vat = normalized["vat"]
            supplier_nif = normalized["supplier_nif"]
            client_nif = normalized["client_nif"]
            doc_date = normalized["doc_date"]
            doc_type = normalized["doc_type"]
            extra_json = normalized["extra_json"]
            extraction_source = "llm"
        else:
            # Strategy 3: invoice2data templates
            if not data:
                # Strategy 4: Regex fallback
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

    confidence = _calculate_confidence(total, vat, supplier_nif, client_nif, doc_date, doc_type, raw_text)

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
