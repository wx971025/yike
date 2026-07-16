from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Reminder, User
from ..schemas import BulkPlanResult, ReminderCreate, ReminderOut, ReminderUpdate
from ..dates import app_today
from ..services.reminder_schedule import (
    advance_remind_date,
    is_reminder_due,
    normalize_recurrence,
)

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


def _get_owned_reminder(reminder_id: int, user: User, db: Session) -> Reminder:
    reminder = (
        db.query(Reminder)
        .filter(Reminder.id == reminder_id, Reminder.user_id == user.id)
        .first()
    )
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="事项不存在"
        )
    return reminder


def _filter_reminders_query(
    user: User,
    db: Session,
    in_plan: bool | None,
    q: str | None,
):
    query = db.query(Reminder).filter(Reminder.user_id == user.id)
    if in_plan is not None:
        query = query.filter(Reminder.in_plan == in_plan)
    if q:
        query = query.filter(Reminder.title.ilike(f"%{q}%"))
    return query


@router.get("", response_model=list[ReminderOut])
def list_reminders(
    in_plan: bool | None = None,
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        _filter_reminders_query(user, db, in_plan, q)
        .order_by(Reminder.remind_date.asc(), Reminder.title.asc())
        .all()
    )


@router.get("/today", response_model=list[ReminderOut])
def list_today_reminders(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = app_today()
    reminders = (
        db.query(Reminder)
        .filter(Reminder.user_id == user.id, Reminder.in_plan.is_(True))
        .order_by(Reminder.remind_date.asc(), Reminder.title.asc())
        .all()
    )
    return [
        reminder
        for reminder in reminders
        if is_reminder_due(
            in_plan=reminder.in_plan,
            remind_date=reminder.remind_date,
            recurrence=reminder.recurrence,
            last_done_at=reminder.last_done_at,
            today=today,
        )
    ]


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(
    payload: ReminderCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        recurrence = normalize_recurrence(payload.recurrence)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    if payload.recurring and recurrence is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="请选择循环提醒规则"
        )
    if not payload.recurring:
        recurrence = None

    reminder = Reminder(
        user_id=user.id,
        title=payload.title.strip(),
        remind_date=payload.remind_date,
        recurrence=recurrence,
        in_plan=payload.in_plan,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.put("/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: int,
    payload: ReminderUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminder = _get_owned_reminder(reminder_id, user, db)
    data = payload.model_dump(exclude_unset=True)

    if "recurring" in data or "recurrence" in data:
        recurring = data.get("recurring", reminder.recurrence is not None)
        recurrence_raw = data.get("recurrence", reminder.recurrence)
        try:
            recurrence = normalize_recurrence(recurrence_raw)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            ) from exc
        if recurring and recurrence is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="请选择循环提醒规则"
            )
        reminder.recurrence = recurrence if recurring else None
        data.pop("recurring", None)
        data.pop("recurrence", None)

    for field, value in data.items():
        if field == "title" and isinstance(value, str):
            value = value.strip()
        setattr(reminder, field, value)

    db.commit()
    db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    reminder_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminder = _get_owned_reminder(reminder_id, user, db)
    db.delete(reminder)
    db.commit()


@router.post("/{reminder_id}/join-plan", response_model=ReminderOut)
def join_plan(
    reminder_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminder = _get_owned_reminder(reminder_id, user, db)
    if reminder.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该事项已在计划中"
        )
    reminder.in_plan = True
    reminder.last_done_at = None
    db.commit()
    db.refresh(reminder)
    return reminder


@router.post("/{reminder_id}/leave-plan", response_model=ReminderOut)
def leave_plan(
    reminder_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminder = _get_owned_reminder(reminder_id, user, db)
    if not reminder.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该事项未在计划中"
        )
    reminder.in_plan = False
    db.commit()
    db.refresh(reminder)
    return reminder


@router.post("/{reminder_id}/done", response_model=ReminderOut)
def mark_done(
    reminder_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminder = _get_owned_reminder(reminder_id, user, db)
    if not reminder.in_plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="该事项未在计划中"
        )
    today = app_today()
    reminder.last_done_at = today
    if reminder.recurrence:
        reminder.remind_date = advance_remind_date(
            reminder.remind_date, reminder.recurrence, after=today
        )
    else:
        reminder.in_plan = False
    db.commit()
    db.refresh(reminder)
    return reminder


@router.post("/join-plan-all", response_model=BulkPlanResult)
def join_plan_all(
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminders = _filter_reminders_query(user, db, in_plan=False, q=q).all()
    for reminder in reminders:
        reminder.in_plan = True
        reminder.last_done_at = None
    db.commit()
    return BulkPlanResult(count=len(reminders))


@router.post("/leave-plan-all", response_model=BulkPlanResult)
def leave_plan_all(
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminders = _filter_reminders_query(user, db, in_plan=True, q=q).all()
    for reminder in reminders:
        reminder.in_plan = False
    db.commit()
    return BulkPlanResult(count=len(reminders))


@router.post("/delete-all", response_model=BulkPlanResult)
def delete_all(
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminders = _filter_reminders_query(user, db, in_plan=None, q=q).all()
    count = len(reminders)
    for reminder in reminders:
        db.delete(reminder)
    db.commit()
    return BulkPlanResult(count=count)
