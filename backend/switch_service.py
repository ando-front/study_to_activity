import asyncio
from pynintendoparental import Authenticator, NintendoParental
import logging

logger = logging.getLogger(__name__)

class SwitchService:
    def __init__(self):
        self._auth = None
        self._api = None

    async def get_auth_url(self):
        """Generate the URL for Nintendo Account login."""
        self._auth = Authenticator()
        return self._auth.get_auth_url()

    async def complete_login(self, response_url: str):
        """Complete the login process and return the session token."""
        if not self._auth:
            self._auth = Authenticator()
        
        # This will extract the code and get the session token
        session_token = await self._auth.complete_login(response_url)
        return session_token

    async def get_devices(self, session_token: str):
        """Get a list of devices associated with the account."""
        if session_token == "dummy_session_token_for_confirmation":
            return [{
                "device_id": "dummy_device_1",
                "name": "E2E Mock Switch",
                "current_limit": 60
            }]
            
        auth = Authenticator(session_token=session_token)
        api = NintendoParental(auth=auth)
        await api.update()
        
        devices = []
        for device in api.devices:
            devices.append({
                "device_id": device.device_id,
                "name": device.name,
                "current_limit": device.daily_limit
            })
        return devices

    async def update_device_limit(self, session_token: str, device_id: str, limit_minutes: int):
        """Update the daily play time limit for a specific device."""
        if session_token == "dummy_session_token_for_confirmation":
            logger.info(f"MOCK: Updated device {device_id} limit to {limit_minutes} min")
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
