## Jungle Coach UI

Next.js UI for the Jungle Coach API (`project1/`). It calls the FastAPI backend and renders:
- a style profile summary
- draft win-condition cards per match
- a coaching report + raw report text

## Getting started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000/analyze`.

## Backend

Start the API first:

```bash
cd ../project1
pip install -r requirements.txt
python -m uvicorn server:app --reload
```
