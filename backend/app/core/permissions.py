from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AppError
from app.services.auth import current_user


def authenticated(request: Request, db: Session = Depends(get_db)):
    return current_user(db, request.app.state.settings, request.cookies.get("access_token"))


def require_roles(*roles):
    def dependency(user=Depends(authenticated)):
        if user.role not in roles:
            raise AppError(403, "FORBIDDEN", "You do not have access to this workspace.")
        return user

    return dependency
