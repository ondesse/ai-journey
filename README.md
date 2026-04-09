# AI Journey

Hands-on projects as I learn AI engineering and build practical apps.

## Projects

### `project1/` — Jungle Coach (FastAPI)

Analyzes recent League of Legends jungle matches via the Riot API and returns:
- a structured player style profile (tempo, ganks, objectives, lane presence)
- an AI-style coaching report (rule-based, deterministic)
- optional per-game breakdowns for UI consumption

Run locally:

```bash
cd project1
pip install -r requirements.txt
python -m uvicorn server:app --reload
```

### `jungle-ui/` — Next.js UI

Next.js app that consumes the API output and renders the analysis UI.

Run locally:

```bash
cd jungle-ui
npm install
npm run dev
```

## Notes

- `project1/.env` is intentionally ignored. Set `RIOT_API_KEY` locally.
