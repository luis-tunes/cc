from fastapi.testclient import TestClient
from app.main import app
import io

client = TestClient(app, raise_server_exceptions=False)

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}

def test_upload_rejects_unsupported_extension():
    r = client.post(
        "/documents/upload",
        files={"file": ("report.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert r.status_code == 422
    assert "accepted" in r.json()["detail"]

def test_upload_rejects_missing_filename():
    r = client.post(
        "/documents/upload",
        files={"file": ("", io.BytesIO(b""), "application/octet-stream")},
    )
    assert r.status_code == 422
