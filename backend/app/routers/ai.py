from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import ChatRequest, ChatResponse
from ..services.ai_chat import chat_with_tools

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    messages = [{"role": m.role, "content": m.content} for m in payload.messages[-20:]]
    context = (
        payload.context.model_dump(exclude_none=True) if payload.context else None
    )
    reply, effects = await chat_with_tools(messages, user, db, context=context)
    return ChatResponse(reply=reply, effects=effects)
