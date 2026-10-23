# OSTutor AI - Your Personal AI Professor

OSTutor AI is a retrieval-augmented learning platform. It is **not** a general chatbot: it teaches, quizzes and examines
students using **only the documents an administrator has uploaded and approved**, and every answer shows the document,
page, retrieved passage and similarity score it came from.

## Features

| Area | What you get |
|---|---|
| **AI Professor** | Interactive, multi-turn lessons that follow Definition → Simple explanation → Detailed explanation → Real-life example → Analogy → Visualization → Flowchart → Diagram → Numerical → Quiz → Interview questions → Summary → Next topic. It checks your understanding each turn and gives feedback on your replies. |
| **Ask the notes (chat)** | ChatGPT-style streaming chat with Markdown, syntax highlighting, LaTeX, copy, regenerate, edit prompt, continue, pinned chats, rename, delete and search. |
| **RAG pipeline** | Loader → text extraction → cleaning → chunking → embeddings → ChromaDB → retriever → LLM → cited answer. |
| **Visual learning** | Mermaid flowcharts, mind maps, sequence / state / ER / network diagrams, decision trees, binary trees, heaps, graphs, stacks, queues and linked lists - all zoomable and pannable, with copy-source and SVG download. |
| **Quizzes** | MCQ, true/false, fill in the blanks, coding and numericals at easy / medium / hard. Graded server-side with explanations. |
| **Viva** | An AI examiner asks questions, scores each answer 0-10, gives feedback and a final report. |
| **Flashcards** | Generated decks with SM-2 style spaced repetition. |
| **Study guides** | Summary, revision notes, formula sheet, mind map, cheat sheet and expected questions. |
| **Dashboard & progress** | Daily streak, study time, weak and strong topics, quiz accuracy, recent chats and bookmarks. |
| **Admin panel** | Document upload and re-indexing, user management, system stats and a retrieval inspector. |
| **Platform** | JWT auth, roles, dark / light theme with persistence, responsive glass UI, accessibility, rate limiting, security headers. |

### Two ways to run the AI

* **With an LLM** - set `LLM_API_KEY` (and optionally `LLM_BASE_URL`, `LLM_MODEL`) for any OpenAI-compatible provider
  (OpenAI, Azure OpenAI, Groq, Together, OpenRouter, Ollama, LM Studio, vLLM, ...). You get natural, adaptive teaching.
* **Offline mode** (default when no key is set) - a built-in teaching engine assembles lessons, quizzes, vivas,
  flashcards and guides directly from the retrieved passages. It is grounded and fully functional, just less fluent.
  The admin panel shows which mode is active.

## Architecture

```
ostutor-ai/
├── backend/                  FastAPI + SQLite + ChromaDB
│   ├── app/
│   │   ├── core/             settings, database, security (JWT/bcrypt), dependencies
│   │   ├── rag/              loaders, cleaning, chunking, embeddings, vector store, retriever, pipeline
│   │   ├── services/         llm, prompts, chat orchestration, generators, offline engine, visuals, progress
│   │   ├── routers/          auth, users, documents, chat, quiz, viva, flashcards, progress, bookmarks, study, search, admin
│   │   ├── middleware.py     request id, security headers, rate limiting (pure ASGI)
│   │   ├── models.py  schemas.py  main.py
│   ├── tests/                pytest suite (auth, RAG, documents, chat, learning features, admin)
│   ├── sample_docs/          operating-systems notes used to seed the knowledge base
│   └── scripts/seed_sample.py
├── frontend/                 Next.js 14 (App Router) + TypeScript + Tailwind + shadcn-style UI + Framer Motion
│   └── src/{app,components,hooks,lib}
├── docker-compose.yml
└── README.md
```

**RAG flow.** Admin uploads a PDF / DOCX / PPTX / TXT / Markdown file → pages are extracted (PDF pages and PPTX slides
keep their real numbers; DOCX / text use ~3000-character virtual pages) → repeated headers and footers are removed and text
is cleaned → LangChain's recursive splitter chunks each page (900 chars, 150 overlap) so page provenance is never lost →
Sentence Transformers embeds the chunks → ChromaDB stores them with cosine distance → at question time the retriever returns
the top matches above a similarity threshold. If nothing relevant is found the tutor says so instead of guessing.

## Quick start (local)

Requirements: **Python 3.10+**, **Node.js 18.18+** (20 recommended).

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                 # edit SECRET_KEY, admin password and (optionally) LLM_API_KEY
python -m scripts.seed_sample        # optional: ingest the bundled sample course notes
uvicorn app.main:app --reload --port 8000
```

API docs: <http://localhost:8000/docs>. On first start an admin account is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
(default `admin@ostutor.ai` / `ChangeMe123!` - **change it**).

The first run downloads the `all-MiniLM-L6-v2` embedding model (~90 MB). To skip the download (for example on a machine
without internet), set `EMBEDDING_BACKEND=hash` in `.env` to use the built-in lexical embeddings.

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local           # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                          # http://localhost:3000
```

### 3. Use it

1. Sign in as the admin → **Course material** → upload your notes (or run the seed script).
2. Register a student account (or ask a classmate to) → **AI Professor** → "Teach me about deadlock".
3. Try **Quizzes**, **Viva**, **Flashcards**, **Study guides** and the **Visual lab**.

## Docker

```bash
cp backend/.env.example backend/.env      # set SECRET_KEY / ADMIN_PASSWORD / LLM_API_KEY
docker compose up --build
```

Frontend on <http://localhost:3000>, API on <http://localhost:8000>. Data (SQLite, uploads, vectors) persists in the
`ostutor-data` volume. `NEXT_PUBLIC_API_URL` is baked in at build time; change the build arg in `docker-compose.yml`
if the API is served from another host.

## Configuration reference (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `SECRET_KEY` | placeholder | JWT signing key - **set a long random value in production** |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | see `.env.example` | Seeded admin account |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | empty / OpenAI / `gpt-4o-mini` | Any OpenAI-compatible endpoint |
| `EMBEDDING_BACKEND` | `auto` | `auto`, `sentence-transformers` or `hash` |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Embedding model |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `900` / `150` | Chunking |
| `RETRIEVAL_TOP_K` / `MIN_SIMILARITY` | `5` / `0.12` | Retrieval breadth and cut-off |
| `CORS_ORIGINS` | localhost:3000 | Comma-separated allowed origins |
| `RATE_LIMIT_PER_MINUTE` | `240` | Per-IP limit (`0` disables) |
| `MAX_UPLOAD_MB` | `50` | Upload size cap |

If you change the embedding model after documents were indexed, use **Re-index** on each document. Each model uses its own
ChromaDB collection, so old vectors never mix with new ones.

## Testing

```bash
cd backend  && pip install -r requirements-dev.txt && pytest          # 43 tests
cd frontend && npm test && npm run typecheck && npm run lint && npm run build
```

## API overview

All routes are under `/api`; authenticated routes take `Authorization: Bearer <token>`.

* `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
* `GET|PUT /users/me`, `PUT /users/me/password`, `GET|PUT /users/me/settings`
* `GET /documents`, `POST /documents` *(admin)*, `POST /documents/{id}/reindex` *(admin)*, `DELETE /documents/{id}` *(admin)*
* `GET|POST /chat/conversations`, `GET|PATCH|DELETE /chat/conversations/{id}`,
  `POST /chat/conversations/{id}/stream` (SSE; actions `send`, `regenerate`, `edit`, `continue`)
* `POST|GET /quizzes`, `GET /quizzes/{id}`, `POST /quizzes/{id}/submit`
* `POST|GET /viva`, `POST /viva/{id}/answer`
* `GET|POST /flashcards/decks`, `GET /flashcards/decks/{id}/cards`, `POST /flashcards/cards/{id}/review`
* `POST|GET /study-guides`, `POST /visuals`
* `GET|POST|DELETE /bookmarks`, `GET /search?q=`, `GET /progress/dashboard`, `POST /progress/heartbeat`
* `GET /admin/stats`, `GET|PATCH|DELETE /admin/users`, `POST /admin/rag/test` *(admin)*

Streaming events: `meta`, `citations`, `token`, `done`, `error` (one JSON object per `data:` line).

## Security notes

* Passwords are hashed with bcrypt; sessions use signed JWTs (7 days by default).
* Only admins can upload documents or see other users; students can only read their own chats, quizzes and progress.
* Uploads are type-checked, size-limited and stored under random names. Mermaid is rendered with `securityLevel: strict`.
* The rate limiter is in-memory and per process. Behind several workers, enforce limits at your gateway as well.
* In production, serve over HTTPS, set a strong `SECRET_KEY`, restrict `CORS_ORIGINS`, and change the admin password.

## Troubleshooting

* **"Cannot reach the OSTutor server"** - the backend isn't running on `NEXT_PUBLIC_API_URL`, or `CORS_ORIGINS` doesn't include the frontend origin.
* **The tutor says it couldn't find anything** - upload documents that cover the topic, or lower `MIN_SIMILARITY`. Use the admin *Retrieval inspector* to see raw scores.
* **A scanned PDF fails to index** - it has no text layer; run OCR on it first.
* **Model download is slow or blocked** - set `EMBEDDING_BACKEND=hash`.


## Sign in with Google and a hosted database

* **Google:** create an OAuth "Web application" client at console.cloud.google.com/apis/credentials, add your site address
  as an authorised JavaScript origin, and set `GOOGLE_CLIENT_ID` on the backend. The button appears by itself.
* **Database:** set `DATABASE_URL` to a Postgres address (Neon is free). `postgres://` and `postgresql://` both work.
  Without it the app keeps using the local SQLite file.
* **Vectors (optional):** set `CHROMA_API_KEY`, `CHROMA_TENANT` and `CHROMA_DATABASE` to use Chroma Cloud so uploaded
  documents survive redeploys.

## Built-in course material

PDF, DOCX, PPTX, TXT and Markdown files placed in `backend/course_docs/` are indexed automatically every time the backend
starts. Files that are already indexed are skipped, and if the search index was wiped (for example by a redeploy on a
free host) it is rebuilt from these files. Deleting one of them in the admin panel removes it from the library but never
deletes the file itself.
