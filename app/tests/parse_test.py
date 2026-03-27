from app.parse import validate_nif


def test_valid_nif():
    assert validate_nif("123456789")
    assert validate_nif("999999990")

def test_invalid_nif_wrong_check():
    assert not validate_nif("123456780")

def test_invalid_nif_too_short():
    assert not validate_nif("12345678")

def test_invalid_nif_letters():
    assert not validate_nif("12345678a")

def test_invalid_nif_empty():
    assert not validate_nif("")
