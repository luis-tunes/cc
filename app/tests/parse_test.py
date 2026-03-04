from app.parse import validate_nif

def test_valid_nif():
    assert validate_nif("123456789") == True
    assert validate_nif("999999990") == True

def test_invalid_nif_wrong_check():
    assert validate_nif("123456780") == False

def test_invalid_nif_too_short():
    assert validate_nif("12345678") == False

def test_invalid_nif_letters():
    assert validate_nif("12345678a") == False

def test_invalid_nif_empty():
    assert validate_nif("") == False
