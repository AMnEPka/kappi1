"""
config/rate_limit.py
Rate limiting configuration using slowapi
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi import Request
import os
import logging

logger = logging.getLogger("ssh_runner")

# Rate limit settings from environment
LOGIN_RATE_LIMIT = os.environ.get('LOGIN_RATE_LIMIT', '5/minute')
API_DEFAULT_RATE_LIMIT = os.environ.get('API_DEFAULT_RATE_LIMIT', '100/minute')


def get_real_ip(request: Request) -> str:
    """
    Get real client IP, considering X-Forwarded-For header from reverse proxy.
    """
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        # Take the first IP in the chain (original client)
        return forwarded_for.split(",")[0].strip()
    
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    
    # Fallback to direct client IP
    return get_remote_address(request)


# Create limiter instance
limiter = Limiter(
    key_func=get_real_ip,
    default_limits=[API_DEFAULT_RATE_LIMIT],
    storage_uri="memory://",  # Use Redis in production: "redis://localhost:6379"
    strategy="fixed-window",
)


def setup_rate_limiting(app):
    """
    Setup rate limiting middleware for FastAPI application.
    Call this in server.py after creating the app.
    """
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    logger.info(f"✅ Rate limiting configured: login={LOGIN_RATE_LIMIT}, api={API_DEFAULT_RATE_LIMIT}")

