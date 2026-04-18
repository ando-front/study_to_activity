import logging
from datetime import date

from sqlalchemy.orm import Session

from backend.models import RewardLog, User, UserRole
from backend.switch_service import switch_service

logger = logging.getLogger(__name__)


def _calculate_switch_limit(db: Session, child_id: int, wallet) -> int:
    """Calculate the effective Switch daily limit: base limit + today's earned bonus.

    The Switch device should reflect the child's base daily limit plus any
    bonus time earned through study rewards today, capped by the wallet balance.
    """
    base_limit = wallet.daily_limit_minutes
    today = date.today()

    # Sum today's reward grants
    today_earned = (
        db.query(RewardLog)
        .filter(RewardLog.child_id == child_id, RewardLog.granted_date == today)
        .all()
    )
    bonus = sum(r.granted_minutes for r in today_earned)

    effective_limit = base_limit + bonus
    # Don't exceed wallet balance (prevents negative enforcement)
    return min(effective_limit, wallet.balance_minutes + base_limit)


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
        # BUG FIX: Use SQLAlchemy .isnot(None) instead of Python `is not None`
        parent = (
            db.query(User)
            .filter(
                User.role == UserRole.PARENT,
                User.nintendo_session_token.isnot(None),
            )
            .first()
        )

        if not parent:
            logger.debug(
                f"Sync skipped: No parent with Nintendo session token found for child {child_id}."
            )
            return

        limit = _calculate_switch_limit(db, child_id, child.wallet)

        logger.info(
            f"Starting background sync for child {child_id} "
            f"(balance: {child.wallet.balance_minutes}, effective_limit: {limit}m)"
        )

        token = parent.get_nintendo_token()
        devices = await switch_service.get_devices(token)
        synced = 0
        for dev in devices:
            success = await switch_service.update_device_limit(
                token, dev["device_id"], limit
            )
            if success:
                synced += 1
                logger.info(
                    f"Successfully synced {limit}m to Switch device: {dev['name']}"
                )
            else:
                logger.error(f"Failed to sync to Switch device: {dev['name']}")

        if synced == 0 and devices:
            logger.error(
                f"Sync failed: 0/{len(devices)} devices updated for child {child_id}"
            )

    except Exception as e:
        logger.error(f"Error in trigger_switch_sync: {e}")
