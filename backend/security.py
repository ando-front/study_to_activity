import os
import secrets

from cryptography.fernet import Fernet
from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader
from passlib.context import CryptContext

# --- PIN Hashing (bcrypt) ---
# passlib will handle salt automatically
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_pin(pin: str) -> str:
    if not pin:
        return None
    return pwd_context.hash(pin)


def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    if not hashed_pin:
        return True  # Default no PIN
    return pwd_context.verify(plain_pin, hashed_pin)


# --- Token Encryption (Fernet) ---
# Use a Master Key from environment variable
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

# Fallback for dev (Should be 32 base64-encoded bytes)
# In production, this must be set!
if not ENCRYPTION_KEY:
    # A default key just to allow the app to run in dev
    # DO NOT USE THIS FOR REAL DATA
    ENCRYPTION_KEY = Fernet.generate_key().decode()

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
# Used to protect sensitive endpoints (e.g. Switch integration) from unauthorized callers.
# Set BACKEND_API_KEY in production. In development the key is optional (skipped if unset).
BACKEND_API_KEY = os.getenv("BACKEND_API_KEY")

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_api_key(api_key: str = Security(_api_key_header)) -> str:
    """FastAPI dependency: enforce X-API-Key header when BACKEND_API_KEY is configured."""
    if not BACKEND_API_KEY:
        # Dev mode: no key configured, allow all requests
        return api_key or ""
    if not api_key or not secrets.compare_digest(api_key, BACKEND_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return api_key
