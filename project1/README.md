# Jungle Analytics API 

A FastAPI backend that analyzes League of Legends jungle games using the Riot API  
and generates a per-player **style profile** + optional **per-game details**.

---

##  Features

-  Fetches a player's recent jungle matches using Riot API  
-  Computes gank patterns, lane presence, objectives, tempo, etc.  
-  Generates a natural-language *coaching-style* jungle report  
-  Safe, retry-aware Riot API requests with rate-limit handling  
-  Optional caching to avoid wasting Riot quota  
-  Clean FastAPI endpoint with Swagger UI

---

##  Requirements

Install all dependencies:

```bash
pip install -r requirements.txt

RIOT_API_KEY=YOUR_API_KEY_HERE

python -m uvicorn server:app --reload

http://127.0.0.1:8000

/analyze?gameName=strangelove&tagLine=NA1&count=20&includeGames=false

{
  "profile": {
    "ganks": {
      "top_pct": 12,
      "mid_pct": 21,
      "bot_pct": 67
    },
    "objectives": {
      "dragons": 1.4,
      "heralds": 0.2
    },
    "style_text": "You play like an aggressive bot-path jungler with strong dragon control."
  },
  "games_analyzed": 12,
  "report_text": "Your early pathing is..."
}
project1/
│── main.py              
│── server.py             
│── .env                 
│── requirements.txt
└── README.md

This project is educational and uses Riot's API in compliance with their rate-limit rules.
No personal data is stored or exposed.