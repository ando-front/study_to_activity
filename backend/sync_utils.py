from sqlalchemy.orm import Session
import logging
from backend.models import User, UserRole, ActivityWallet
from backend.switch_service import switch_service

logger = logging.getLogger(__name__)

async def trigger_switch_sync(db: Session, child_id: int):
    """
    子供の現在のウォレット残高を、連携済みの Nintendo Switch デバイスに同期する。
    承認フローのバックグラウンドタスクとして呼び出されることを想定。
    """
    try:
        # 子供のウォレット情報を取得
        child = db.query(User).filter(User.id == child_id, User.role == UserRole.CHILD).first()
        if not child or not child.wallet:
            logger.warning(f"Sync skipped: Child {child_id} or wallet not found.")
            return

        # 同期用の親ユーザー（トークン保持者）を検索
        # 現状は親子 1:1 または親が共通であることを前提とし、トークンを持つ最初の親を探す
        parent = db.query(User).filter(
            User.role == UserRole.PARENT,
            User.nintendo_session_token != None
        ).first()

        if not parent:
            logger.debug(f"Sync skipped: No parent with Nintendo session token found for child {child_id}.")
            return

        balance = child.wallet.balance_minutes
        limit = min(balance, child.wallet.daily_limit_minutes)

        logger.info(f"Starting background sync for child {child_id} (balance: {balance}, limit: {limit}m)")
        
        devices = await switch_service.get_devices(parent.nintendo_session_token)
        for dev in devices:
            success = await switch_service.update_device_limit(
                parent.nintendo_session_token, 
                dev["device_id"], 
                limit
            )
            if success:
                logger.info(f"Successfully synced {limit}m to Switch device: {dev['name']}")
            else:
                logger.error(f"Failed to sync to Switch device: {dev['name']}")

    except Exception as e:
        logger.error(f"Error in trigger_switch_sync: {e}")
