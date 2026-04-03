from __future__ import annotations

import logging
import time
from urllib.parse import urlparse, parse_qs

from pynintendoparental import Authenticator, NintendoParental

logger = logging.getLogger(__name__)

# Pending auth sessions TTL (seconds)
_PENDING_TTL = 600  # 10 minutes


def _extract_session_token_code(input_str: str) -> str:
    """
    Extract session_token_code from either:
    - Full redirect URL: npf54789befb391a838://auth#session_token_code=XXX&state=YYY
    - Fragment only: session_token_code=XXX&state=YYY
    - Raw code: XXX (no separators)
    """
    s = input_str.strip()

    # Full URL: parse fragment (Nintendo puts params in the fragment, not query)
    if "://" in s or s.startswith("http"):
        try:
            parsed = urlparse(s)
            fragment = parsed.fragment or parsed.query
            if fragment:
                params = {}
                for part in fragment.split("&"):
                    if "=" in part:
                        k, v = part.split("=", 1)
                        params[k] = v
                if "session_token_code" in params:
                    return params["session_token_code"]
        except Exception:
            pass

    # Fragment / query string pasted directly
    if "session_token_code=" in s:
        params = {}
        for part in s.split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                params[k] = v
        if "session_token_code" in params:
            return params["session_token_code"]

    # Assume the raw code was pasted
    return s


class SwitchService:
    def __init__(self):
        # state -> {verifier, created_at, session_token (once complete)}
        self._pending: dict[str, dict] = {}

    def _cleanup_pending(self):
        """Remove expired pending sessions."""
        now = time.time()
        self._pending = {
            k: v
            for k, v in self._pending.items()
            if now - v["created_at"] < _PENDING_TTL
        }

    async def get_auth_url(self):
        """Generate the URL for Nintendo Account login."""
        self._cleanup_pending()
        auth = Authenticator.generate_login()

        # Extract state from the generated login URL for session tracking
        parsed = urlparse(auth.login_url)
        state = parse_qs(parsed.query).get("state", [None])[0]

        if state:
            self._pending[state] = {
                "verifier": auth._auth_code_verifier,
                "created_at": time.time(),
                "session_token": None,
            }

        return {
            "url": auth.login_url,
            "verifier": auth._auth_code_verifier,
            "state": state,
        }

    async def complete_login(self, response_url: str, verifier: str | None = None, state: str | None = None):
        """Complete the login using the full redirect URL."""
        verifier_to_use = verifier
        if state and state in self._pending and not verifier_to_use:
            verifier_to_use = self._pending[state]["verifier"]

        if not verifier_to_use:
            raise RuntimeError("認証開始からやり直してください")

        auth = Authenticator(auth_code_verifier=verifier_to_use)
        auth = await Authenticator.complete_login(auth, response_url)
        session_token = auth.get_session_token

        if state and state in self._pending:
            self._pending[state]["session_token"] = session_token

        return session_token

    async def complete_login_with_code(
        self,
        session_token_code: str,
        verifier: str | None = None,
        state: str | None = None,
    ):
        """Complete the login using a session_token_code (accepts full URL, fragment, or raw code)."""
        code = _extract_session_token_code(session_token_code)

        verifier_to_use = verifier
        if state and state in self._pending and not verifier_to_use:
            verifier_to_use = self._pending[state]["verifier"]

        if not verifier_to_use:
            raise RuntimeError("認証開始からやり直してください")

        auth = Authenticator(auth_code_verifier=verifier_to_use)
        # Directly call perform_login — no need to reconstruct the full redirect URL
        await auth.perform_login(code)
        session_token = auth.get_session_token

        if state and state in self._pending:
            self._pending[state]["session_token"] = session_token

        return session_token

    def get_auth_status(self, state: str) -> dict:
        """Poll whether authentication for a given state is complete."""
        if state not in self._pending:
            return {"status": "unknown"}
        pending = self._pending[state]
        if pending.get("session_token"):
            token = pending["session_token"]
            del self._pending[state]
            return {"status": "complete", "session_token": token}
        age = time.time() - pending["created_at"]
        if age > _PENDING_TTL:
            del self._pending[state]
            return {"status": "expired"}
        return {"status": "pending"}

    async def get_devices(self, session_token: str):
        """Get a list of devices associated with the account."""
        if session_token == "dummy_session_token_for_confirmation":
            return [
                {
                    "device_id": "dummy_device_1",
                    "name": "E2E Mock Switch",
                    "current_limit": 60,
                }
            ]

        auth = Authenticator(session_token=session_token)
        api = NintendoParental(auth=auth)
        await api.update()

        devices = []
        for device in api.devices:
            devices.append(
                {
                    "device_id": device.device_id,
                    "name": device.name,
                    "current_limit": device.daily_limit,
                }
            )
        return devices

    async def update_device_limit(
        self, session_token: str, device_id: str, limit_minutes: int
    ):
        """Update the daily play time limit for a specific device."""
        if session_token == "dummy_session_token_for_confirmation":
            logger.info(
                f"MOCK: Updated device {device_id} limit to {limit_minutes} min"
            )
            return True

        auth = Authenticator(session_token=session_token)
        api = NintendoParental(auth=auth)
        await api.update()

        for device in api.devices:
            if device.device_id == device_id:
                await device.set_daily_limit(limit_minutes)
                return True
        return False


# Global instance
switch_service = SwitchService()
