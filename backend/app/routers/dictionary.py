from fastapi import APIRouter, Depends

from ..deps import get_current_user
from ..models import User
from ..schemas import DictionaryEntryOut, DictionaryStatusOut
from ..services.dictionary import dictionary_status, lookup_word, schedule_dictionary_setup

router = APIRouter(prefix="/api/dictionary", tags=["dictionary"])


@router.get("/status", response_model=DictionaryStatusOut)
def get_status(user: User = Depends(get_current_user)):
    schedule_dictionary_setup()
    return dictionary_status()


@router.get("/lookup/{word}", response_model=DictionaryEntryOut)
def lookup(word: str, user: User = Depends(get_current_user)):
    schedule_dictionary_setup()
    return lookup_word(word).to_dict()
