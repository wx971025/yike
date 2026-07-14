from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Skill, User
from ..schemas import SkillCatalogOut, SkillOut

router = APIRouter(prefix="/api/skills", tags=["skills"])


def _get_owned_skill(skill_id: int, user: User, db: Session) -> Skill:
    skill = (
        db.query(Skill).filter(Skill.id == skill_id, Skill.user_id == user.id).first()
    )
    if not skill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill 不存在")
    return skill


@router.get("", response_model=list[SkillCatalogOut])
def list_skills(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Skill)
        .filter(Skill.user_id == user.id)
        .order_by(Skill.created_at.desc())
        .all()
    )


@router.get("/{skill_id}", response_model=SkillOut)
def get_skill(
    skill_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_owned_skill(skill_id, user, db)


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_skill(
    skill_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    skill = _get_owned_skill(skill_id, user, db)
    db.delete(skill)
    db.commit()
