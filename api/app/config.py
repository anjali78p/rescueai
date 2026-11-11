import os
import secrets
from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


class Settings:
    def __init__(self) -> None:
        self.jwt_secret = os.getenv("JWT_SECRET") or secrets.token_urlsafe(48)
        self.jwt_secret_is_ephemeral = not os.getenv("JWT_SECRET")
        self.jwt_ttl_hours = int(os.getenv("JWT_TTL_HOURS", "168"))
        self.cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
        self.demo_mode = _bool("DEMO_MODE", True)
        self.demo_password = os.getenv("DEMO_PASSWORD", "rescue123")
        self.store = os.getenv("STORE", "json")
        self.data_file = os.getenv("DATA_FILE", "./data/store.json")
        self.firebase_credentials = os.getenv("FIREBASE_CREDENTIALS")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


settings = Settings()
