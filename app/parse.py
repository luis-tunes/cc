import os
import re
import tempfile
from datetime import date
from decimal import Decimal
import httpx
from invoice2data import extract_data
from invoice2data.extract.loader import read_templates
from app.db import get_conn

PAPERLESS_URL = os.environ.get("PAPERLESS_URL", "http://paperless:8000")
PAPERLESS_TOKEN = os.environ.get("PAPERLESS_TOKEN", "")
TEMPLATES_DIR = os.path.dirname(__file__)

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

def fetch_document_text(paperless_id: int) -> str:
    """Fetch the OCR plain-text content from Paperless (fallback parser)."""
    url = f"{PAPERLESS_URL}/api/documents/{paperless_id}/"
    headers = {"Authorization": f"Token {PAPERLESS_TOKEN}"}
    r = httpx.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json().get("content", "")

_AMOUNT_RE = re.compile(
    r"(?:Total|Amount|Montante|TOTAL|Valor)\s*[:\s]*(?:[A-Z€]{0,3}\s*)?"
    r"([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2})\s*(?:EUR|€)?",
    re.IGNORECASE | re.DOTALL,
)
# Broader fallback: any currency-formatted number (e.g. "2.021,74€")
_MONEY_RE = re.compile(r"([\d]{1,3}(?:\.\d{3})+,\d{2}|[\d]{1,3},\d{2})\s*€")
_DATE_RE = re.compile(r"(\d{1,2})\s+(\w{3,9})\s+(\d{4})", re.IGNORECASE)
_NIF_RE = re.compile(r"\b(\d{9})\b")

_PT_MONTHS = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
    "janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4, "maio": 5,
    "junho": 6, "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10,
    "novembro": 11, "dezembro": 12,
}

def _parse_amount_from_text(text: str) -> Decimal:
    m = _AMOUNT_RE.search(text)
    if m:
        raw = m.group(1).replace(".", "").replace(",", ".")
        return Decimal(raw)
    # Fallback: find all euro amounts, take the largest (usually the total)
    candidates = _MONEY_RE.findall(text)
    if candidates:
        amounts = [Decimal(c.replace(".", "").replace(",", ".")) for c in candidates]
        return max(amounts)
    raise ValueError("could not find amount in document text")

def _parse_date_from_text(text: str) -> date:
    m = _DATE_RE.search(text)
    if m:
        day = int(m.group(1))
        month_str = m.group(2).lower()
        year = int(m.group(3))
        month = _PT_MONTHS.get(month_str[:3])
        if month:
            return date(year, month, day)
    return date.today()

def parse_invoice(pdf_bytes: bytes) -> dict:
    path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(pdf_bytes)
            f.flush()
            path = f.name
        result = extract_data(path, templates=get_templates())
    except (OSError, EnvironmentError):
        # pdftotext not available — fall through to OCR text fallback
        result = None
    finally:
        if path:
            os.unlink(path)
    return result  # may be None/False — ingest_document handles fallback

def ingest_document(paperless_id: int) -> int:
    pdf = fetch_document_file(paperless_id)
    data = parse_invoice(pdf)

    # ── Fallback: use Paperless OCR text when invoice2data finds nothing ──
    if not data:
        text = fetch_document_text(paperless_id)
        try:
            total = _parse_amount_from_text(text)
        except ValueError:
            raise ValueError("could not extract amount from document")
        doc_date = _parse_date_from_text(text)
        nifs = [n for n in _NIF_RE.findall(text) if validate_nif(n)]
        supplier_nif = nifs[0] if len(nifs) >= 1 else "000000000"
        client_nif   = nifs[1] if len(nifs) >= 2 else "000000000"
        data = {
            "amount": total,
            "vat": Decimal("0"),
            "date": doc_date,
            "issuer_nif": supplier_nif,
            "client_nif": client_nif,
            "invoice_type": "transfer",
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
    doc_type = str(data.get("invoice_type", "invoice"))

    with get_conn() as conn:
        row = conn.execute(
            """INSERT INTO documents (supplier_nif, client_nif, total, vat, date, type, paperless_id)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (paperless_id) DO UPDATE
                 SET total=EXCLUDED.total, vat=EXCLUDED.vat, date=EXCLUDED.date,
                     type=EXCLUDED.type, supplier_nif=EXCLUDED.supplier_nif,
                     client_nif=EXCLUDED.client_nif
               RETURNING id""",
            (supplier_nif, client_nif, total, vat, doc_date, doc_type, paperless_id),
        ).fetchone()
        conn.commit()
    return row["id"]
