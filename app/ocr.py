"""OCR abstraction layer.

Swappable OCR engine via OCR_ENGINE env var.
Engines:
  - 'paperless' (default): Uses Paperless-ngx Tesseract output, falls back to pdftotext.
  - 'google': Google Document AI — high accuracy for Portuguese invoices.
  - 'azure': Azure AI Document Intelligence — good accuracy, EU data residency.

Set OCR_ENGINE=google|azure and configure the relevant env vars.
"""

import logging
import os

log = logging.getLogger(__name__)

OCR_ENGINE = os.environ.get("OCR_ENGINE", "paperless")


def extract_text(pdf_bytes: bytes, paperless_id: int | None = None) -> str:
    """Extract text from PDF bytes using the configured OCR engine.

    Tries the configured engine first, falls back to pdftotext on failure.

    Args:
        pdf_bytes: Raw PDF file content.
        paperless_id: Paperless document ID (used by paperless engine).

    Returns:
        Extracted plain text.
    """
    engine = OCR_ENGINE.lower()

    if engine == "paperless":
        return _extract_paperless(pdf_bytes, paperless_id)
    if engine == "google":
        text = _extract_google_documentai(pdf_bytes)
        if text:
            return text
        log.warning("Google Document AI returned empty, falling back to pdftotext")
        return _extract_pdftotext(pdf_bytes)
    if engine == "azure":
        text = _extract_azure(pdf_bytes)
        if text:
            return text
        log.warning("Azure Document Intelligence returned empty, falling back to pdftotext")
        return _extract_pdftotext(pdf_bytes)

    raise ValueError(f"Unknown OCR engine: {OCR_ENGINE}")


def _extract_paperless(pdf_bytes: bytes, paperless_id: int | None) -> str:
    """Use Paperless-ngx pre-extracted OCR text."""
    if paperless_id is None:
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

    return _extract_pdftotext(pdf_bytes)


def _extract_google_documentai(pdf_bytes: bytes) -> str:
    """Extract text using Google Document AI.

    Required env vars:
      GOOGLE_PROJECT_ID: GCP project ID
      GOOGLE_LOCATION: Processor location (e.g. 'eu' for EU data residency)
      GOOGLE_PROCESSOR_ID: Document AI processor ID
      GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON (or use workload identity)
    """
    try:
        from google.cloud import documentai_v1 as documentai
    except ImportError:
        log.error("google-cloud-documentai not installed. Run: pip install google-cloud-documentai")
        return ""

    project_id = os.environ.get("GOOGLE_PROJECT_ID", "")
    location = os.environ.get("GOOGLE_LOCATION", "eu")
    processor_id = os.environ.get("GOOGLE_PROCESSOR_ID", "")

    if not project_id or not processor_id:
        log.error("GOOGLE_PROJECT_ID and GOOGLE_PROCESSOR_ID required for Google Document AI")
        return ""

    try:
        client = documentai.DocumentProcessorServiceClient(
            client_options={"api_endpoint": f"{location}-documentai.googleapis.com"}
        )
        name = client.processor_path(project_id, location, processor_id)
        raw_document = documentai.RawDocument(content=pdf_bytes, mime_type="application/pdf")
        request = documentai.ProcessRequest(name=name, raw_document=raw_document)
        result = client.process_document(request=request)
        return result.document.text or ""
    except Exception as e:
        log.error("Google Document AI extraction failed: %s", e)
        return ""


def _extract_azure(pdf_bytes: bytes) -> str:
    """Extract text using Azure AI Document Intelligence (Form Recognizer).

    Required env vars:
      AZURE_FORM_RECOGNIZER_ENDPOINT: e.g. https://westeurope.api.cognitive.microsoft.com/
      AZURE_FORM_RECOGNIZER_KEY: API key
    """
    try:
        from azure.ai.formrecognizer import DocumentAnalysisClient
        from azure.core.credentials import AzureKeyCredential
    except ImportError:
        log.error("azure-ai-formrecognizer not installed. Run: pip install azure-ai-formrecognizer")
        return ""

    endpoint = os.environ.get("AZURE_FORM_RECOGNIZER_ENDPOINT", "")
    key = os.environ.get("AZURE_FORM_RECOGNIZER_KEY", "")

    if not endpoint or not key:
        log.error("AZURE_FORM_RECOGNIZER_ENDPOINT and AZURE_FORM_RECOGNIZER_KEY required")
        return ""

    try:
        client = DocumentAnalysisClient(endpoint=endpoint, credential=AzureKeyCredential(key))
        poller = client.begin_analyze_document("prebuilt-invoice", document=pdf_bytes)
        result = poller.result()
        # Concatenate all page text
        text_parts = []
        for page in result.pages:
            for line in page.lines:
                text_parts.append(line.content)
        return "\n".join(text_parts)
    except Exception as e:
        log.error("Azure Document Intelligence extraction failed: %s", e)
        return ""


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
