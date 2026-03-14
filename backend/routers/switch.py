from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging

from backend.database import get_db
from backend.models import User, UserRole, ActivityWallet
from backend.schemas import SwitchAuthUrl, SwitchConnectRequest, SwitchDeviceOut, SwitchSyncResponse
from backend.switch_service import switch_service

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/auth-url", response_model=SwitchAuthUrl)
async def get_switch_auth_url():
    """Get the URL to start Nintendo Account authentication."""
    url = await switch_service.get_auth_url()
    return {"url": url}

@router.post("/connect", response_model=dict)
async def connect_switch(data: SwitchConnectRequest, db: Session = Depends(get_db)):
    """Complete the connection by exchanging the response URL for a session token."""
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    try:
        session_token = await switch_service.complete_login(data.response_url)
        user.set_nintendo_token(session_token)
        db.commit()
        return {"message": "Nintendo Account と連携しました"}
    except Exception as e:
        logger.error(f"Failed to connect Switch: {e}")
        raise HTTPException(status_code=400, detail=f"連携に失敗しました: {str(e)}")

@router.get("/devices/{user_id}", response_model=list[SwitchDeviceOut])
async def list_switch_devices(user_id: int, db: Session = Depends(get_db)):
    """List devices associated with the linked Nintendo account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.nintendo_session_token:
        raise HTTPException(status_code=400, detail="Nintendo Account が連携されていません")
    
    try:
        token = user.get_nintendo_token()
        devices = await switch_service.get_devices(token)
        return devices
    except Exception as e:
        logger.error(f"Failed to list devices: {e}")
        raise HTTPException(status_code=500, detail="デバイス情報の取得に失敗しました")

@router.post("/sync/{user_id}", response_model=SwitchSyncResponse)
async def sync_balance_to_switch(user_id: int, db: Session = Depends(get_db)):
    """Sync the child's wallet balance to all linked Switch devices."""
    # Note: In a real app, we might need a mapping between child user and Switch device
    # For now, we'll sync the first CHILD's balance to all devices of the parent's account
    parent = db.query(User).filter(User.id == user_id, User.role == UserRole.PARENT).first()
    if not parent or not parent.nintendo_session_token:
        raise HTTPException(status_code=400, detail="親ユーザーが特定できないか、連携されていません")
    
    # Get the child (assuming one child for simplicity in this Phase)
    child = db.query(User).filter(User.role == UserRole.CHILD).first()
    if not child or not child.wallet:
        raise HTTPException(status_code=404, detail="子供のウォレットが見つかりません")
    
    balance = child.wallet.balance_minutes
    # Switch daily limit is capped at balanced or daily_limit_minutes
    limit = min(balance, child.wallet.daily_limit_minutes)
    
    try:
        token = parent.get_nintendo_token()
        devices = await switch_service.get_devices(token)
        synced_names = []
        for dev in devices:
            success = await switch_service.update_device_limit(
                token, 
                dev["device_id"], 
                limit
            )
            if success:
                synced_names.append(dev["name"])
        
        return {
            "message": f"{limit}分 を同期しました",
            "synced_devices": synced_names
        }
    except Exception as e:
        logger.error(f"Failed to sync to Switch: {e}")
        raise HTTPException(status_code=500, detail="Switch への同期に失敗しました")
