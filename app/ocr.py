"""OCR abstraction layer.

Swappable OCR engine via OCR_ENGINE env var.
Default: 'paperless' (uses Paperless-ngx Tesseract output).
Future: 'google' (Google Document AI), 'azure' (Azure Form Recognizer).
"""

import logging
import os

log = logging.getLogger(__name__)

OCR_ENGINE = os.environ.get("OCR_ENGINE", "paperless")


def extract_text(pdf_bytes: bytes, paperless_id: int | None = None) -> str:
    """Extract text from PDF bytes using the configured OCR engine.

    Args:
        pdf_bytes: Raw PDF file content.
        paperless_id: Paperless document ID (used by paperless engine).

    Returns:
        Extracted plain text.
    """
    if OCR_ENGINE == "paperless":
        return _extract_paperless(pdf_bytes, paperless_id)
    raise ValueError(f"Unknown OCR engine: {OCR_ENGINE}")


def _extract_paperless(pdf_bytes: bytes, paperless_id: int | None) -> str:
    """Use Paperless-ngx pre-extracted OCR text."""
    if paperless_id is None:
        # Try local pdftotext as fallback
        return _extract_pdftotext(pdf_bytes)

    import httpx
    paperless_url = os.environ.get("PAPERLESS_URL", "http://paperless:8000")
    paperless_token = os.environ.get("PAPERLESS_TOKEN", "")
    url = f"{paperless_url}/api/documents/{paperless_id}/"
    headers = {"Authorization": f"Token {paperless_token}"}
    try:
        r = httpx.get(url, headers=headers, timeout=30)
        r.raise_for_status()
        text = r.json().get("content", "")
        if text:
            return text
    except Exception as e:
        log.warning("Paperless text fetch failed: %s", e)

    # Fallback to local pdftotext
    return _extract_pdftotext(pdf_bytes)


def _extract_pdftotext(pdf_bytes: bytes) -> str:
    """Local fallback using pdftotext (poppler-utils)."""
    import subprocess
    import tempfile
    path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(pdf_bytes)
            f.flush()
            path = f.name
        result = subprocess.run(
            ["pdftotext", "-layout", path, "-"],
            capture_output=True, timeout=30
        )
        if result.returncode == 0:
            return result.stdout.decode("utf-8", errors="replace")
    except (OSError, subprocess.TimeoutExpired) as e:
        log.warning("pdftotext not available: %s", e)
    finally:
        if path:
            os.unlink(path)
    return ""
