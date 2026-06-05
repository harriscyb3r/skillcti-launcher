from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from config import settings

router = APIRouter()


@router.get("/skill/{skill_name}", response_class=PlainTextResponse)
async def get_skill(skill_name: str):
    if not skill_name or "/" in skill_name or "\\" in skill_name or ".." in skill_name:
        raise HTTPException(400, "invalid skill name")
    skill_md = settings.skills_root / skill_name / "SKILL.md"
    if not skill_md.exists():
        raise HTTPException(404, f"skill not found: {skill_name}")
    return skill_md.read_text(encoding="utf-8")
