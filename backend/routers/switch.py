import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pynintendoauth.exceptions import InvalidSessionTokenException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, UserRole
from backend.schemas import (
    SwitchAuthUrl,
    SwitchCallbackRequest,
    SwitchConnectRequest,
    SwitchDeviceOut,
    SwitchSyncResponse,
)
from backend.security import require_api_key
from backend.switch_service import switch_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get(
    "/auth-url", response_model=SwitchAuthUrl, dependencies=[Depends(require_api_key)]
)
async def get_switch_auth_url():
    """Get the URL to start Nintendo Account authentication."""
    return await switch_service.get_auth_url()


@router.post("/connect", response_model=dict, dependencies=[Depends(require_api_key)])
async def connect_switch(
    data: SwitchConnectRequest, db: Annotated[Session, Depends(get_db)]
):
    """Complete the connection by exchanging the response URL for a session token."""
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    try:
        session_token = await switch_service.complete_login(
            data.response_url, data.verifier, data.state
        )
        user.set_nintendo_token(session_token)
        db.commit()
        return {"message": "Nintendo Account と連携しました"}
    except ValueError as e:
        logger.error(f"Failed to parse Switch response URL: {e}")
        raise HTTPException(
            status_code=400,
            detail="URLの形式が正しくありません。コピーしたURL全体を貼り付けるか、session_token_codeの値のみを入力してください。",
        ) from e
    except Exception as e:
        logger.error(f"Failed to connect Switch: {e}")
        raise HTTPException(
            status_code=400,
            detail="Nintendo Account の認証に失敗しました。URLが正しいか、有効期限が切れていないか確認してください。",
        ) from e


@router.post("/callback", response_model=dict, dependencies=[Depends(require_api_key)])
async def switch_callback(
    data: SwitchCallbackRequest, db: Annotated[Session, Depends(get_db)]
):
    """Complete the connection using session_token_code (accepts full URL, fragment, or raw code).

    More flexible than /connect — the user only needs to provide the session_token_code
    value (or paste the full redirect URL) rather than the complete npf:// response URL.
    """
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    try:
        session_token = await switch_service.complete_login_with_code(
            data.session_token_code, data.verifier, data.state
        )
        user.set_nintendo_token(session_token)
        db.commit()
        return {"message": "Nintendo Account と連携しました"}
    except ValueError as e:
        logger.error(f"Failed to parse Switch session_token_code: {e}")
        raise HTTPException(
            status_code=400,
            detail="コードの形式が正しくありません。URLまたはsession_token_codeの値を確認してください。",
        ) from e
    except Exception as e:
        logger.error(f"Failed to connect Switch via callback: {e}")
        raise HTTPException(
            status_code=400,
            detail="Nintendo Account の認証に失敗しました。コードが正しいか、有効期限が切れていないか確認してください。",
        ) from e


@router.get("/auth-status/{state}", dependencies=[Depends(require_api_key)])
async def get_auth_status(
    state: str, user_id: int, db: Annotated[Session, Depends(get_db)]
):
    """Poll whether Nintendo authentication for a given state is complete.

    Returns {"status": "pending" | "complete" | "expired" | "unknown"}.
    When complete, the session token is automatically persisted to the user record.
    """
    result = switch_service.get_auth_status(state)

    if result["status"] == "complete" and result.get("session_token"):
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.set_nintendo_token(result["session_token"])
            db.commit()

    return {"status": result["status"]}


@router.get(
    "/devices/{user_id}",
    response_model=list[SwitchDeviceOut],
    dependencies=[Depends(require_api_key)],
)
async def list_switch_devices(user_id: int, db: Annotated[Session, Depends(get_db)]):
    """List devices associated with the linked Nintendo account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.nintendo_session_token:
        raise HTTPException(
            status_code=400, detail="Nintendo Account が連携されていません"
        )

    try:
        token = user.get_nintendo_token()
        if not token:
            raise HTTPException(
                status_code=400,
                detail="連携情報が無効です。再度 Nintendo Account の連携を行ってください。",
            )
        devices = await switch_service.get_devices(token)
        return devices
    except HTTPException:
        raise
    except InvalidSessionTokenException as err:
        logger.warning(f"Invalid session token for user {user_id}")
        raise HTTPException(
            status_code=400,
            detail="Nintendo のセッションが期限切れです。再度連携を行ってください。",
        ) from err
    except Exception as e:
        logger.error(f"Failed to list devices: {e}")
        raise HTTPException(
            status_code=500, detail="デバイス情報の取得に失敗しました"
        ) from e


@router.post(
    "/sync/{user_id}",
    response_model=SwitchSyncResponse,
    dependencies=[Depends(require_api_key)],
)
async def sync_balance_to_switch(user_id: int, db: Annotated[Session, Depends(get_db)]):
    """Sync the child's wallet balance to all linked Switch devices."""
    from backend.sync_utils import _calculate_switch_limit

    parent = (
        db.query(User).filter(User.id == user_id, User.role == UserRole.PARENT).first()
    )
    if not parent or not parent.nintendo_session_token:
        raise HTTPException(
            status_code=400, detail="親ユーザーが特定できないか、連携されていません"
        )

    # Get the child (assuming one child for simplicity in this Phase)
    child = db.query(User).filter(User.role == UserRole.CHILD).first()
    if not child or not child.wallet:
        raise HTTPException(status_code=404, detail="子供のウォレットが見つかりません")

    limit = _calculate_switch_limit(db, child.id, child.wallet)

    try:
        token = parent.get_nintendo_token()
        if not token:
            raise HTTPException(
                status_code=400,
                detail="連携情報が無効です。再度 Nintendo Account の連携を行ってください。",
            )
        devices = await switch_service.get_devices(token)
        synced_names = []
        failed_names = []
        for dev in devices:
            success = await switch_service.update_device_limit(
                token, dev["device_id"], limit
            )
            if success:
                synced_names.append(dev["name"])
            else:
                failed_names.append(dev["name"])

        if not synced_names and devices:
            raise HTTPException(
                status_code=500,
                detail=f"デバイスの更新に失敗しました: {', '.join(failed_names)}",
            )

        return {"message": f"{limit}分 を同期しました", "synced_devices": synced_names}
    except HTTPException:
        raise
    except InvalidSessionTokenException as err:
        logger.warning(f"Invalid session token for user {user_id}")
        raise HTTPException(
            status_code=400,
            detail="Nintendo のセッションが期限切れです。再度連携を行ってください。",
        ) from err
    except Exception as e:
        logger.error(f"Failed to sync to Switch: {e}")
        raise HTTPException(
            status_code=500, detail="Switch への同期に失敗しました"
        ) from e
