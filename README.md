# Medical Conditions RAG · React Frontend

The user-facing layer of the medical-conditions RAG pipeline. It does two jobs:

1. **Chatbot.** A streaming chat client for the FastAPI RAG service. It reads Server-Sent Events over `fetch`, validates every event with zod, shows progress stages, and supports stop and new-chat.
2. **A visual tour of the pipeline, written for non-technical readers.** The home page shows the whole pipeline as one horizontal line of 3D stations, with data changing shape as it moves from station to station. Each station page then follows the same order:
   - its place in the pipeline;
   - an animated 3D scene told in three or four short steps, each with a plain-language caption and the technical term next to it;
   - three numbers;
   - one interactive picture;
   - an **Under the hood** panel for engineers, with code, real data samples, the audit and run commands.

   Every number, sample and scene is driven by a snapshot of the real pipeline database.

It replaces the original Streamlit prototype (`medical_conditions_frontend`).

The pipeline has four repositories:

| Station | Repository |
| --- | --- |
| Scraper | [MedicalChatbotScraper](https://github.com/davidsanbric-dev/MedicalChatbotScraper) |
| Worker | [MedicalChatbotWorker](https://github.com/davidsanbric-dev/MedicalChatbotWorker) |
| Database + RAG API | [MedicalChatbotAPI](https://github.com/davidsanbric-dev/MedicalChatbotAPI) |
| Interface | **MedicalChatbotWeb** (this one) |

## Stack

| Concern | Tool |
| --- | --- |
| UI | React 19, TypeScript (strict), Vite |
| Routing / code splitting | TanStack Router |
| Live API data | TanStack Query |
| Tables | TanStack Table |
| Client state | Zustand (chat session persisted per tab, 3D ↔ card hover link) |
| Runtime validation | Zod (snapshot file, REST responses, SSE events) |
| Styling | Tailwind CSS v4 (one token set: surfaces, ink, layer and status colors) |
| 3D | three.js, @react-three/fiber, @react-three/drei. Every scene shares one stage: camera angle, lights, floor, DOM labels, fit-to-view. |
| Markdown answers | react-markdown + remark-gfm |

## Running locally

```bash
npm install
cp .env.example .env              # API_UPSTREAM=http://localhost:8001
npm run dev                       # http://localhost:5173
```

The browser always calls the API through the same-origin `/_api` prefix. Vite proxies it in development, and nginx proxies it in production, so the API needs no CORS configuration.

```bash
npm run build      # type-check + production build
npm run lint
```

## Docker / deployment

```bash
docker build -t medical-rag-frontend .
docker run -p 8504:80 -e API_UPSTREAM=https://<api-host> medical-rag-frontend
# or: docker compose up -d --build   (reads API_UPSTREAM and FRONTEND_PORT from .env)
```

The image is a two-stage build: Node builds the app, then `nginx:alpine` serves it. The official nginx image renders `nginx/default.conf.template` with `envsubst` at startup, so `API_UPSTREAM` is set per deployment without rebuilding. The proxy disables buffering so SSE tokens arrive immediately, and unknown paths fall back to `index.html` for client-side routes.

On Dokploy, `API_UPSTREAM` can be the API's public URL or its internal service URL on the shared Docker network.

## The data snapshot

`src/data/snapshot.json` is generated, never hand-edited. Rebuilding it needs the scraper and worker repos cloned next to this one, as `medical_conditions_scraper/` and `medical_conditions_worker/`. Then run:

```bash
# 1. throwaway Postgres + pgvector
docker run -d --rm --name medsnap-pg -e POSTGRES_PASSWORD=snap \
  -e POSTGRES_DB=medical_conditions_db -p 127.0.0.1:55433:5432 pgvector/pgvector:pg15
export DATABASE_URL=postgresql://postgres:snap@localhost:55433/medical_conditions_db

# 2. seed raw_data from the scraper's saved JSON output
uv run scripts/load_raw_from_json.py ../medical_conditions_scraper/scraped

# 3. run the real worker (processing + embeddings)
(cd ../medical_conditions_worker && uv run python main.py)

# 4. export what the pages render
uv run scripts/export_snapshot.py

docker stop medsnap-pg
```

`export_snapshot.py` computes the following:
- stage counts and table sizes;
- per-condition statistics;
- a data-quality audit;
- a sample record traced through all three tables;
- a **3-D t-SNE map** of every chunk embedding. The sample questions are fitted with it, so each question lands next to the passages it retrieves. The map is then rotated onto its principal axes so it sits wide in the horizontal scenes;
- retrieval traces that reproduce the API's retrieval: top-20 cosine search, `ms-marco-MiniLM` re-rank, threshold −2.0, top 5.

Both scripts declare their dependencies inline (PEP 723), so `uv run` needs no separate virtual environment. The app validates the snapshot against a zod schema at startup.

## Project layout

```
src/
  data/layers.ts            the stations: names, plain-language copy, colors, repos
  data/snapshot.ts          zod schema + typed snapshot access
  lib/api.ts                REST calls and the SSE stream reader
  stores/                   zustand stores (chat, home hover link)
  components/layout/        app shell, pipeline map, the LayerPage template
  components/story/         step player that drives each 3D scene
  components/three/
    stage.tsx               shared camera, lights, floor, labels, fit-to-view
    parts.tsx               platforms, belts, station models, travelling items
    point-cloud.tsx         instanced 3-D meaning map (565 passages)
    scenes/                 home line + one scene per station
  components/viz/           page anatomy, lineage trace, bar list, re-rank chart
  components/ui/            primitives, JSON tree, data table
  pages/                    home, five station pages, chat
scripts/                    snapshot seeding and export
nginx/                      production server template
```

### Accessibility and motion

- Every scene has a text description.
- Story captions are plain text, and the steps are buttons.
- Status is never shown by color alone.
- The 3D scenes stop rendering while they are offscreen.
- With `prefers-reduced-motion`, scenes render still frames and nothing plays automatically.
- On narrow screens, the camera glides to the part of the scene the current step is about.

## Disclaimer

This is an educational demo. Its content is scraped from a public telehealth site and is not medical advice.
