from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from main import analyze_jungler_for_riot_id, get_jungle_report_text

app = FastAPI(title="Jungle Coach API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeResponse(BaseModel):
    profile: Dict[str, Any]
    games_analyzed: int
    report_text: str
    ai_coach: Dict[str, Any]
    player_games: Optional[List[Dict[str, Any]]] = None


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/analyze", response_model=AnalyzeResponse)
def analyze(
    gameName: str,
    tagLine: str,
    count: int = 100,
    includeGames: bool = False,
):
    if count < 1 or count > 100:
        raise HTTPException(
            status_code=400,
            detail="count must be between 1 and 100",
        )

    try:
        result = analyze_jungler_for_riot_id(
            game_name=gameName,
            tag_line=tagLine,
            match_count=count,
        )
        player_games = result["player_games"]
        profile = result["profile"]
        ai_coach = result["ai_coach"]
        report_text = get_jungle_report_text(player_games)

        return AnalyzeResponse(
            profile=profile,
            games_analyzed=len(player_games),
            report_text=report_text,
            ai_coach=ai_coach,
            player_games=player_games if includeGames else None,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected server error.")