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
from app.db import get_conn
from app.ocr import extract_text
from app.classify import classify_document

log = logging.getLogger(__name__)

PAPERLESS_URL = os.environ.get("PAPERLESS_URL", "http://paperless:8000")
PAPERLESS_TOKEN = os.environ.get("PAPERLESS_TOKEN", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
TEMPLATES_DIR = os.path.dirname(__file__)

# -- LLM extraction prompt --

_LLM_EXTRACTION_PROMPT = """\
You are a Portuguese accounting document parser. Extract structured data from OCR text.

Return ONLY valid JSON with these exact fields:
{
  "total": number (total amount in EUR, 0 if not found),
  "vat": number (IVA/VAT amount in EUR, 0 if not found),
  "supplier_nif": string (9-digit supplier/issuer NIF, "000000000" if not found),
  "client_nif": string (9-digit client/buyer NIF, "000000000" if not found),
  "date": string (ISO YYYY-MM-DD, null if not found),
  "type": string (one of: "fatura", "recibo", "nota-credito", "nota-debito", "extrato", "outro"),
  "description": string (brief summary of the document, max 80 chars, in Portuguese)
}

Extraction rules:
- Portuguese amounts use comma for decimals and dot for thousands: 1.234,56 means 1234.56
- NIF is always exactly 9 digits
- "Total a Pagar", "Total c/ IVA", "Montante", "Valor Total" = total amount
- "IVA", "I.V.A.", "Taxa de IVA" = VAT amount
- If multiple totals, pick the final/largest (usually "Total a Pagar" or "Total c/ IVA")
- VAT rates in Portugal: 23%, 13%, 6%
- Date formats: DD/MM/YYYY, DD-MM-YYYY, DD de Mês de YYYY, YYYY-MM-DD
- Fatura = invoice, Recibo = receipt, Nota de Crédito = credit note
- First NIF label (NIF, NIPC, Contribuinte) = supplier; second or "NIF Cliente" = client
- Return numbers as plain numbers (1234.56), NOT strings"""


def _extract_with_llm(text: str) -> dict | None:
    """Use OpenAI to extract structured data from OCR text. Returns parsed dict or None."""
    if not OPENAI_API_KEY:
        return None

    truncated = text[:6000]
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
            },
            timeout=30,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        log.info("LLM extraction succeeded: total=%s vat=%s type=%s",
                 parsed.get("total"), parsed.get("vat"), parsed.get("type"))
        return parsed
    except Exception as exc:
        log.warning("LLM extraction failed: %s", exc)
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
    return r.json()

def fetch_document_text(paperless_id: int) -> str:
    """Fetch the OCR plain-text content from Paperless (fallback parser)."""
    meta = fetch_document_metadata(paperless_id)
    return meta.get("content", "")


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
        month = _PT_MONTHS.get(month_str) or _PT_MONTHS.get(month_str[:3])
        if month:
            try:
                return date(year, month, day)
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
        month = _PT_MONTHS.get(month_str) or _PT_MONTHS.get(month_str[:3])
        if month:
            try:
                return date(year, month, day)
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
    except (OSError, EnvironmentError) as exc:
        log.warning("pdftotext not available, falling back to OCR text: %s", exc)
        result = None
    finally:
        if path:
            os.unlink(path)
    return result


def ingest_document(paperless_id: int, tenant_id: str | None = None) -> int:
    pdf = fetch_document_file(paperless_id)
    data = parse_invoice(pdf)

    try:
        meta = fetch_document_metadata(paperless_id)
        paperless_filename = meta.get("original_file_name", "") or ""
        paperless_content = meta.get("content", "") or ""
    except Exception:
        paperless_filename = ""
        paperless_content = ""

    raw_text = extract_text(pdf, paperless_id=paperless_id)

    if len(paperless_content) > len(raw_text):
        raw_text = paperless_content

    log.info("ingest: paperless_id=%d filename=%s raw_text_len=%d invoice2data=%s",
             paperless_id, paperless_filename, len(raw_text), bool(data))
    if len(raw_text) < 50:
        log.warning("ingest: very short OCR text (%d chars): %r", len(raw_text), raw_text[:200])

    # Strategy 1: LLM extraction (best quality)
    llm_result = _extract_with_llm(raw_text) if len(raw_text) >= 20 else None
    if llm_result and llm_result.get("total", 0) > 0:
        log.info("ingest: using LLM extraction")
        try:
            total = Decimal(str(llm_result["total"]))
        except (InvalidOperation, ValueError):
            total = Decimal("0")
        try:
            vat = Decimal(str(llm_result.get("vat", "0")))
        except (InvalidOperation, ValueError):
            vat = Decimal("0")
        supplier_nif = str(llm_result.get("supplier_nif", "000000000")).strip()
        client_nif = str(llm_result.get("client_nif", "000000000")).strip()
        llm_date = llm_result.get("date")
        if llm_date:
            try:
                doc_date = date.fromisoformat(llm_date)
            except (ValueError, TypeError):
                doc_date = _parse_date_from_text(raw_text)
        else:
            doc_date = _parse_date_from_text(raw_text)
        doc_type = llm_result.get("type", "outro")
        if doc_type not in ("fatura", "recibo", "nota-credito", "nota-debito", "extrato", "outro"):
            doc_type = "outro"
        # Validate NIFs from LLM
        if supplier_nif != "000000000" and not validate_nif(supplier_nif):
            supplier_nif = "000000000"
        if client_nif != "000000000" and not validate_nif(client_nif):
            client_nif = "000000000"
        extraction_source = "llm"
    else:
        extraction_source = "regex"
        # Strategy 2: invoice2data templates
        if not data:
            # Strategy 3: Regex fallback
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

    if confidence >= 60:
        status = "extraído"
    elif total > 0:
        status = "extraído"
    else:
        status = "pendente"

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

            # Fallback: recent upload without filename match (only if we have a filename to try)
            if not pending:
                pending = conn.execute(
                    """SELECT id, tenant_id FROM documents
                       WHERE paperless_id IS NULL
                         AND status IN ('pendente ocr', 'a processar')
                         AND created_at > now() - interval '1 hour'
                       ORDER BY created_at DESC LIMIT 1""",
                ).fetchone()

        if pending:
            effective_tenant = pending["tenant_id"] or tenant_id
            conn.execute(
                """UPDATE documents
                   SET supplier_nif=%s, client_nif=%s, total=%s, vat=%s, date=%s,
                       type=%s, paperless_id=%s, raw_text=%s, status=%s, tenant_id=%s
                   WHERE id = %s""",
                (supplier_nif, client_nif, total, vat, doc_date, doc_type,
                 paperless_id, raw_text, status, effective_tenant, pending["id"]),
            )
            conn.commit()
            doc_id = pending["id"]
            tenant_id = effective_tenant
            log.info("ingest: updated pending doc id=%d tenant=%s total=%s confidence=%d",
                     doc_id, tenant_id, total, confidence)
        else:
            row = conn.execute(
                """INSERT INTO documents (tenant_id, supplier_nif, client_nif, total, vat, date, type, paperless_id, raw_text, status)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (paperless_id) DO UPDATE
                     SET total=EXCLUDED.total, vat=EXCLUDED.vat, date=EXCLUDED.date,
                         type=EXCLUDED.type, supplier_nif=EXCLUDED.supplier_nif,
                         client_nif=EXCLUDED.client_nif, raw_text=EXCLUDED.raw_text,
                         status=EXCLUDED.status
                   RETURNING id""",
                (tenant_id, supplier_nif, client_nif, total, vat, doc_date, doc_type, paperless_id, raw_text, status),
            ).fetchone()
            conn.commit()
            doc_id = row["id"]
            log.info("ingest: inserted new doc id=%d tenant=%s total=%s confidence=%d",
                     doc_id, tenant_id, total, confidence)

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

    return doc_id
