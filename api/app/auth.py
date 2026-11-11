import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .state import get_store

_bearer = HTTPBearer(auto_error=False)
_ITER = 200_000


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITER)
    return f"{salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, _ = stored.split("$", 1)
    except ValueError:
        return False
    return hmac.compare_digest(hash_password(password, bytes.fromhex(salt_hex)), stored)


def create_user(name: str, email: str, password: str, role: str, **extra) -> dict:
    email = email.strip().lower()
    doc = {
        "id": uuid.uuid4().hex,
        "email": email,
        "name": name,
        "role": role,
        "password": hash_password(password),
        "created_at": datetime.now(timezone.utc).isoformat(),
        **extra,
    }
    get_store().put("users", email, doc)
    return doc


def public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"], "name": u["name"], "role": u["role"]}


def make_token(user: dict) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_ttl_hours)
    return jwt.encode({"sub": user["email"], "role": user["role"], "exp": exp}, settings.jwt_secret, algorithm="HS256")


def user_from_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired. Sign in again.")
    user = get_store().get("users", payload["sub"])
    if not user:
        raise HTTPException(401, "Account no longer exists.")
    return user  # role is read from the DB, not trusted from the token


def get_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    if not creds:
        raise HTTPException(401, "Sign in required.")
    return user_from_token(creds.credentials)


def require(*roles: str):
    def dep(user: dict = Depends(get_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(403, "Your role cannot do this.")
        return user

    return dep
