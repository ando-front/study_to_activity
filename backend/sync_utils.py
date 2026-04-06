import logging

from sqlalchemy.orm import Session

from backend.models import User, UserRole
from backend.switch_service import switch_service

logger = logging.getLogger(__name__)


async def trigger_switch_sync(db: Session, child_id: int):
    """
    子供の現在のウォレット残高を、連携済みの Nintendo Switch デバイスに同期する。
    承認フローのバックグラウンドタスクとして呼び出されることを想定。
    """
    try:
        # 子供のウォレット情報を取得
        child = (
            db.query(User)
            .filter(User.id == child_id, User.role == UserRole.CHILD)
            .first()
        )
        if not child or not child.wallet:
            logger.warning(f"Sync skipped: Child {child_id} or wallet not found.")
            return

        # 同期用の親ユーザー（トークン保持者）を検索
        # 現状は親子 1:1 または親が共通であることを前提とし、トークンを持つ最初の親を探す
        parent = (
            db.query(User)
            .filter(
                User.role == UserRole.PARENT, User.nintendo_session_token != None  # noqa: E711
            )
            .first()
        )

        if not parent:
            logger.debug(
                f"Sync skipped: No parent with Nintendo session token found for child {child_id}."
            )
            return

        balance = child.wallet.balance_minutes
        limit = min(balance, child.wallet.daily_limit_minutes)

        logger.info(
            f"Starting background sync for child {child_id} (balance: {balance}m, daily_limit: {child.wallet.daily_limit_minutes}m, sending: {limit}m)"
        )

        token = parent.get_nintendo_token()
        devices = await switch_service.get_devices(token)
        if not devices:
            logger.warning(f"Sync skipped: No Switch devices found for child {child_id}")
            return

        for dev in devices:
            logger.info(f"Syncing {limit}m to Switch device: {dev['name']} (id={dev['device_id']}, current_limit={dev.get('current_limit')}m)")
            success = await switch_service.update_device_limit(
                token, dev["device_id"], limit
            )
            if success:
                logger.info(
                    f"Successfully synced {limit}m to Switch device: {dev['name']}"
                )
            else:
                logger.error(f"Failed to sync to Switch device: {dev['name']} — device not found in API response")

    except Exception as e:
        logger.error(f"Error in trigger_switch_sync: {e}")
