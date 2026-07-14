"""
JWT Authentication & Rate Limiting for FinSight API.

Opt-in via FINSIGHT_AUTH_ENABLED=1 in environment.
When disabled (default), all routes remain open for local dev.
"""
import os
import time
import logging
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ── Configuration ──
AUTH_ENABLED = os.environ.get("FINSIGHT_AUTH_ENABLED", "0") == "1"
JWT_SECRET = os.environ.get("FINSIGHT_JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = int(os.environ.get("FINSIGHT_TOKEN_EXPIRE_HOURS", "24"))
RATE_LIMIT_PER_MINUTE = int(os.environ.get("FINSIGHT_RATE_LIMIT", "60"))

if AUTH_ENABLED and not JWT_SECRET:
    JWT_SECRET = "finsight-dev-secret-CHANGE-IN-PRODUCTION"
    logger.warning(
        "⚠️  FINSIGHT_JWT_SECRET is not set! Using an insecure dev fallback. "
        "Set a strong secret in production via environment variable."
    )

# ── Password Hashing ──
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── OAuth2 Scheme ──
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


# ── In-Memory User Store (swap with a DB in production) ──
_users_db: dict[str, dict] = {}


# ── Rate Limiting (sliding window) ──
_rate_window: dict[str, list[float]] = defaultdict(list)


# ── Schemas ──
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RegisterRequest(BaseModel):
    username: str
    password: str


# ── Core Functions ──

def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(sub: str, expires_delta: Optional[timedelta] = None) -> str:
    expires_delta = expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": sub, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _check_rate_limit(user_id: str) -> None:
    """Sliding-window rate limiter: RATE_LIMIT_PER_MINUTE requests per 60s."""
    now = time.time()
    window = _rate_window[user_id]
    # Prune entries older than 60s
    _rate_window[user_id] = [t for t in window if now - t < 60]
    if len(_rate_window[user_id]) >= RATE_LIMIT_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded ({RATE_LIMIT_PER_MINUTE} requests/min). Please slow down.",
        )
    _rate_window[user_id].append(now)


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[str]:
    """FastAPI dependency that decodes JWT and returns the user subject.
    
    When AUTH_ENABLED is False, returns None (no auth enforced).
    When AUTH_ENABLED is True, requires a valid Bearer token.
    """
    if not AUTH_ENABLED:
        return None

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Pass a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject.",
            )
        user_id: str = sub
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Rate limit check
    _check_rate_limit(user_id)

    return user_id


# ── Auth Route Handlers (called from main.py) ──

def register_user(req: RegisterRequest) -> TokenResponse:
    """Register a new user and return a JWT."""
    if req.username in _users_db:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{req.username}' is already taken.",
        )
    _users_db[req.username] = {
        "username": req.username,
        "hashed_password": _hash_password(req.password),
    }
    token = create_access_token(sub=req.username)
    logger.info(f"✅ User '{req.username}' registered successfully.")
    return TokenResponse(
        access_token=token,
        expires_in=ACCESS_TOKEN_EXPIRE_HOURS * 3600,
    )


def login_user(form: OAuth2PasswordRequestForm) -> TokenResponse:
    """Authenticate and return a JWT."""
    user = _users_db.get(form.username)
    if not user or not _verify_password(form.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(sub=form.username)
    logger.info(f"✅ User '{form.username}' logged in.")
    return TokenResponse(
        access_token=token,
        expires_in=ACCESS_TOKEN_EXPIRE_HOURS * 3600,
    )
