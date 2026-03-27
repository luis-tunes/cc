"""Tests for OCR engine abstraction layer."""
import os
from unittest.mock import patch, MagicMock

import pytest


@pytest.fixture(autouse=True)
def _reset_engine(monkeypatch):
    """Reset OCR_ENGINE to default between tests."""
    monkeypatch.setattr("app.ocr.OCR_ENGINE", "paperless")


def test_extract_text_unknown_engine(monkeypatch):
    monkeypatch.setattr("app.ocr.OCR_ENGINE", "unknown_engine")
    from app.ocr import extract_text
    with pytest.raises(ValueError, match="Unknown OCR engine"):
        extract_text(b"fake pdf", None)


def test_extract_paperless_no_id():
    """When paperless_id is None, fallback to pdftotext."""
    from app.ocr import _extract_paperless
    with patch("app.ocr._extract_pdftotext", return_value="pdftotext output") as mock_pdf:
        result = _extract_paperless(b"pdf bytes", None)
        assert result == "pdftotext output"
        mock_pdf.assert_called_once_with(b"pdf bytes")


def test_extract_paperless_with_id_success(monkeypatch):
    """Fetch OCR text from Paperless API."""
    from app.ocr import _extract_paperless

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"content": "Fatura 123\nTotal: 100€"}
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.get", return_value=mock_resp) as mock_get:
        monkeypatch.setenv("PAPERLESS_URL", "http://paperless:8000")
        monkeypatch.setenv("PAPERLESS_TOKEN", "tok123")
        result = _extract_paperless(b"pdf bytes", 42)
        assert result == "Fatura 123\nTotal: 100€"
        mock_get.assert_called_once()
        call_args = mock_get.call_args
        assert "/api/documents/42/" in call_args[0][0]


def test_extract_paperless_api_failure(monkeypatch):
    """When Paperless API fails, fallback to pdftotext."""
    from app.ocr import _extract_paperless

    monkeypatch.setenv("PAPERLESS_URL", "http://paperless:8000")
    monkeypatch.setenv("PAPERLESS_TOKEN", "tok123")

    with patch("httpx.get", side_effect=Exception("Connection refused")), \
         patch("app.ocr._extract_pdftotext", return_value="fallback") as mock_pdf:
        result = _extract_paperless(b"pdf", 42)
        assert result == "fallback"
        mock_pdf.assert_called_once()


def test_extract_paperless_empty_content(monkeypatch):
    """When Paperless returns empty content, fallback to pdftotext."""
    from app.ocr import _extract_paperless

    monkeypatch.setenv("PAPERLESS_URL", "http://paperless:8000")
    monkeypatch.setenv("PAPERLESS_TOKEN", "tok123")

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"content": ""}
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.get", return_value=mock_resp), \
         patch("app.ocr._extract_pdftotext", return_value="pdftotext text"):
        result = _extract_paperless(b"pdf", 42)
        assert result == "pdftotext text"


def test_extract_text_google_engine(monkeypatch):
    """Google engine with success + fallback on empty."""
    monkeypatch.setattr("app.ocr.OCR_ENGINE", "google")
    from app.ocr import extract_text

    with patch("app.ocr._extract_google_documentai", return_value="google text"):
        result = extract_text(b"pdf", None)
        assert result == "google text"


def test_extract_text_google_fallback_on_empty(monkeypatch):
    """Google returns empty → fallback to pdftotext."""
    monkeypatch.setattr("app.ocr.OCR_ENGINE", "google")
    from app.ocr import extract_text

    with patch("app.ocr._extract_google_documentai", return_value=""), \
         patch("app.ocr._extract_pdftotext", return_value="pdftotext"):
        result = extract_text(b"pdf", None)
        assert result == "pdftotext"


def test_extract_text_azure_engine(monkeypatch):
    monkeypatch.setattr("app.ocr.OCR_ENGINE", "azure")
    from app.ocr import extract_text

    with patch("app.ocr._extract_azure", return_value="azure text"):
        result = extract_text(b"pdf", None)
        assert result == "azure text"


def test_extract_text_azure_fallback_on_empty(monkeypatch):
    monkeypatch.setattr("app.ocr.OCR_ENGINE", "azure")
    from app.ocr import extract_text

    with patch("app.ocr._extract_azure", return_value=""), \
         patch("app.ocr._extract_pdftotext", return_value="pdftotext"):
        result = extract_text(b"pdf", None)
        assert result == "pdftotext"


def test_google_missing_env(monkeypatch):
    """Google engine returns empty when env vars missing."""
    monkeypatch.delenv("GOOGLE_PROJECT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_PROCESSOR_ID", raising=False)

    # Mock the import to avoid requiring google-cloud-documentai
    mock_documentai = MagicMock()
    with patch.dict("sys.modules", {"google.cloud.documentai_v1": mock_documentai, "google.cloud": MagicMock(), "google": MagicMock()}):
        from app.ocr import _extract_google_documentai
        result = _extract_google_documentai(b"pdf")
        assert result == ""


def test_azure_missing_env(monkeypatch):
    """Azure engine returns empty when env vars missing."""
    monkeypatch.delenv("AZURE_FORM_RECOGNIZER_ENDPOINT", raising=False)
    monkeypatch.delenv("AZURE_FORM_RECOGNIZER_KEY", raising=False)

    mock_azure = MagicMock()
    mock_creds = MagicMock()
    with patch.dict("sys.modules", {"azure.ai.formrecognizer": mock_azure, "azure.core.credentials": mock_creds, "azure": MagicMock(), "azure.ai": MagicMock(), "azure.core": MagicMock()}):
        from app.ocr import _extract_azure
        result = _extract_azure(b"pdf")
        assert result == ""


def test_pdftotext_success():
    """pdftotext extraction with mocked subprocess."""
    from app.ocr import _extract_pdftotext

    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = "extracted text".encode()

    with patch("subprocess.run", return_value=mock_result):
        result = _extract_pdftotext(b"pdf bytes")
        assert result == "extracted text"


def test_pdftotext_failure():
    """pdftotext returns empty on OSError."""
    from app.ocr import _extract_pdftotext

    with patch("subprocess.run", side_effect=OSError("not found")):
        result = _extract_pdftotext(b"pdf bytes")
        assert result == ""
