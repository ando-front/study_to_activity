"""LINE Notify integration for sending notifications to parents."""

import logging

import httpx

logger = logging.getLogger(__name__)

LINE_NOTIFY_API = "https://notify-api.line.me/api/notify"


def send_line_notify(token: str, message: str) -> bool:
    """Send a LINE Notify message.

    Args:
        token: LINE Notify personal access token.
        message: Message text to send.

    Returns:
        True if sent successfully, False otherwise.
    """
    if not token:
        logger.warning("LINE Notify token is empty, skipping notification")
        return False

    try:
        response = httpx.post(
            LINE_NOTIFY_API,
            headers={"Authorization": f"Bearer {token}"},
            data={"message": message},
            timeout=10,
        )
        if response.status_code == 200:
            logger.info("LINE Notify sent successfully")
            return True
        else:
            logger.warning("LINE Notify failed: %s %s", response.status_code, response.text)
            return False
    except Exception as exc:
        logger.error("LINE Notify error: %s", exc)
        return False


def notify_approval_request(token: str, child_name: str, subject: str, minutes: int):
    """Notify parent that a child has submitted a task for approval."""
    message = (
        f"\n📚 承認依頼が届きました！\n"
        f"👦 {child_name}\n"
        f"📖 科目: {subject}\n"
        f"⏱ 学習時間: {minutes}分\n"
        f"S2Aアプリで承認してください。"
    )
    return send_line_notify(token, message)


def notify_game_timeout(token: str, child_name: str):
    """Notify parent that a child's game time has expired."""
    message = (
        f"\n⏰ ゲーム時間終了のお知らせ\n"
        f"👦 {child_name}のゲーム時間が終了しました。"
    )
    return send_line_notify(token, message)
