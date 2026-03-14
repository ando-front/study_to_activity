import os

from cryptography.fernet import Fernet
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
