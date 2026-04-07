"""FastAPI auth dependency — verifies Supabase JWT on protected routes."""

import jwt
from jwt import PyJWKClient
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import config

security = HTTPBearer()

# Supabase exposes a JWKS endpoint for ES256 token verification.
_jwks_url = f"{config.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
_jwks_client = PyJWKClient(_jwks_url, cache_keys=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Decode and verify the Supabase access token.

    Returns the JWT payload with at minimum:
      - sub: the user's UUID (maps to clinician_id)
      - email: the user's email
    """
    token = credentials.credentials
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth error: {e}")

    return payload
