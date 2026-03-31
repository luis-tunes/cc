---
description: "Generate a pytest test file following TIM conventions with FakeConn pattern."
agent: "agent"
argument-hint: "What module or feature to test"
---
Create a test file following TIM conventions:

1. Read [conftest.py](../../app/tests/conftest.py) to understand the FakeConn mock
2. Read the module being tested to understand its functions
3. Create the test file as `app/tests/{module}_test.py` (NOT `test_{module}.py`)

Use this pattern:

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)

def test_feature_happy_path():
    r = client.get("/api/endpoint")
    assert r.status_code == 200
    data = r.json()
    assert "expected_key" in data

def test_feature_not_found():
    r = client.get("/api/endpoint/999999")
    assert r.status_code == 404
```

Rules:
- Plain functions, no classes. `test_` prefix.
- Use `@patch` for external deps (OCR, Stripe, OpenAI)
- Assert status code first, then response shape
- Test both happy path and error cases
- One test per behavior, not per line of code
