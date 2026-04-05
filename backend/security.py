import os
import secrets

from cryptography.fernet import Fernet
from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader
from passlib.context import CryptContext

# --- PIN Hashing (bcrypt) ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_pin(pin: str | None) -> str | None:
    if not pin:
        return None
    return pwd_context.hash(pin)


def verify_pin(plain_pin: str | None, hashed_pin: str | None) -> bool:
    """Verify a PIN against its stored hash.

    Returns True if the PIN matches, False otherwise.
    Handles legacy plain-text PINs stored before bcrypt was introduced.
    """
    if not hashed_pin:
        return True  # No PIN required
    if not plain_pin:
        return False  # PIN required but not provided
    try:
        return pwd_context.verify(plain_pin, hashed_pin)
    except Exception:
        # Fallback for legacy plain-text PINs stored before bcrypt migration
        return plain_pin == hashed_pin

# --- Token Encryption (Fernet) ---
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    raise RuntimeError(
        "ENCRYPTION_KEY 環境変数が設定されていません。"
        "以下のコマンドで生成してください:\n"
        "  python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    )
fernet = Fernet(ENCRYPTION_KEY.encode())

def encrypt_token(token: str) -> str:
    if not token:
        return None
    return fernet.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    if not encrypted_token:
        return None
    return fernet.decrypt(encrypted_token.encode()).decode()

# --- API Key Authentication ---
BACKEND_API_KEY = os.getenv("BACKEND_API_KEY")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

def require_api_key(api_key: str = Security(_api_key_header)) -> str:
    if not BACKEND_API_KEY:
        return api_key or ""
    if not api_key or not secrets.compare_digest(api_key, BACKEND_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return api_key
