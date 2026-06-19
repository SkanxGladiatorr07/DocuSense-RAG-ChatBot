# DocuSense — System Architecture

This document describes the end-to-end technical architecture of the DocuSense RAG ChatBot, from a user's question to the final AI-generated response.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                            USER                                 │
│              (types a question in the chat UI)                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / HTTP (via Vite proxy)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                    React + Vite (port 3000)                     │
│                                                                 │
│  ┌──────────┐   ┌─────────────┐   ┌──────────────────────────┐ │
│  │  Navbar  │   │  Dashboard  │   │    Chat Input Component   │ │
│  └──────────┘   └─────────────┘   └──────────────────────────┘ │
│                                                                 │
│  services/api.js  →  Axios instance  →  POST /api/v1/chat      │
└────────────────────────────┬────────────────────────────────────┘
                             │ JSON (REST API call)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                          BACKEND                                │
│                   Express.js (port 5000)                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     Middleware Stack                     │   │
│  │  cors() → express.json() → morgan → routes → errors     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  routes/chatRoutes  →  controllers/chatController               │
│                ↓                                               │
│         services/ragService.js                                  │
│           (orchestrates the full RAG pipeline)                  │
│                                                                 │
│  ┌──────────────────────────────────────┐                      │
│  │            MongoDB (Mongoose)         │                      │
│  │  - Chat sessions & message history   │                      │
│  │  - Document metadata                 │                      │
│  │  - User accounts (future)            │                      │
│  └──────────────────────────────────────┘                      │
└──────────────┬───────────────────────────┬──────────────────────┘
               │                           │
               │ embed query               │ save/load
               ▼                           ▼
┌──────────────────────────┐   ┌─────────────────────────────────┐
│      VECTOR STORE         │   │           MONGODB               │
│  Pinecone / ChromaDB      │   │   docusense database            │
│                           │   │                                 │
│  - Stores document chunk  │   │  Collections:                   │
│    embeddings (float32)   │   │  • chats                        │
│  - Performs ANN (approx.  │   │  • documents                    │
│    nearest neighbour)     │   │  • users (future)               │
│    similarity search      │   │                                 │
│  - Returns top-K chunks   │   └─────────────────────────────────┘
└──────────────┬────────────┘
               │ top-K relevant chunks
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                            LLM                                  │
│                OpenAI GPT-4o (via LangChain.js)                 │
│                                                                 │
│  Prompt construction:                                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  System: "You are a helpful assistant. Answer using       │  │
│  │   only the provided context. Cite sources."               │  │
│  │  Context: [chunk_1] [chunk_2] ... [chunk_K]               │  │
│  │  User: "What is the leave policy for new employees?"      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Output: Grounded answer + source references                   │
└────────────────────────────┬────────────────────────────────────┘
                             │ JSON response (streamed or batch)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                          RESPONSE                               │
│                                                                 │
│  {                                                              │
│    "success": true,                                             │
│    "data": {                                                    │
│      "answer": "New employees are entitled to...",             │
│      "sources": ["HR_Policy_2024.pdf, page 12"]                │
│    }                                                            │
│  }                                                              │
│                                                                 │
│  Rendered in the Dashboard chat UI → displayed to the User      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Frontend (React + Vite)

| File / Folder | Responsibility |
|---|---|
| `src/routes/AppRoutes.jsx` | Declares all page routes |
| `src/layouts/MainLayout.jsx` | Shared Navbar shell via `<Outlet>` |
| `src/pages/Dashboard.jsx` | Chat UI + document panel |
| `src/services/api.js` | Axios instance — single base URL, interceptors |
| `src/hooks/useApi.js` | Generic loading/error/data state hook |

### 2. Backend (Express.js)

| File / Folder | Responsibility |
|---|---|
| `src/app.js` | Express factory — registers all middleware and routes |
| `src/server.js` | Binds HTTP server, connects DB, handles graceful shutdown |
| `src/config/env.js` | Loads `.env`, validates required vars, exports typed config |
| `src/config/db.js` | Mongoose connect/disconnect + runtime event listeners |
| `src/middleware/errorHandler.js` | Global error handler (ApiError, Mongoose errors, fallback) |
| `src/utils/ApiError.js` | Custom error class with HTTP status code |
| `src/utils/ApiResponse.js` | Standardised `{ success, message, data }` response shape |
| `src/utils/logger.js` | Colour-coded, level-filtered console logger |

### 3. RAG Pipeline (Planned — Phase 2 & 3)

```
Document Upload
      │
      ▼
Text Extraction (pdf-parse / mammoth)
      │
      ▼
Recursive Text Chunking (LangChain RecursiveCharacterTextSplitter)
      │
      ▼
Embedding Generation (OpenAI text-embedding-ada-002)
      │
      ▼
Vector Upsert (Pinecone / ChromaDB)
      │
      ▼  ← Query time starts here
Embed User Query
      │
      ▼
Similarity Search (top-K chunks)
      │
      ▼
Prompt Assembly (system + context + user question)
      │
      ▼
LLM Completion (GPT-4o via LangChain)
      │
      ▼
Stream / Return Answer + Sources
```

---

## Data Flow Diagram

```
[Document] ──upload──► [Backend]
                           │
                    extract & chunk
                           │
                    embed (OpenAI)
                           │
                  ┌────────▼─────────┐
                  │   Vector Store    │
                  │  (Pinecone /      │
                  │   ChromaDB)       │
                  └────────▲─────────┘
                           │
[User Query] ──────► embed query
                           │
                      similarity
                        search
                           │
                    top-K chunks
                           │
               ┌───────────▼──────────────┐
               │  LLM (GPT-4o)            │
               │  prompt = system +       │
               │          context +       │
               │          query           │
               └───────────┬──────────────┘
                           │
                    ┌──────▼──────┐
                    │  Answer +   │
                    │  Sources    │
                    └──────┬──────┘
                           │
                    [User sees response]
```

---

## API Design

### Current Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Root health check |
| `GET` | `/api/v1/` | API v1 health check |

### Planned Endpoints (Phase 2 & 3)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/documents/upload` | Upload and process a document |
| `GET` | `/api/v1/documents` | List all uploaded documents |
| `DELETE` | `/api/v1/documents/:id` | Remove a document |
| `POST` | `/api/v1/chat` | Send a message, receive AI answer |
| `GET` | `/api/v1/chat/history` | Get chat message history |
| `POST` | `/api/v1/auth/register` | Register a new user |
| `POST` | `/api/v1/auth/login` | Login and receive JWT |

---

## Security Considerations

- All secrets stored in `.env` files (never committed to Git)
- CORS restricted to known frontend origins via `CORS_ORIGIN`
- JWT authentication planned for Phase 4
- MongoDB Atlas IP whitelist or local-only binding in development
- File uploads: type validation + size limits via Multer
- Rate limiting to be added before production deployment

---

## Deployment Plan (Phase 4)

| Component | Platform |
|---|---|
| Backend API | Railway / Render |
| Frontend SPA | Vercel / Netlify |
| MongoDB | MongoDB Atlas (M0 Free Tier) |
| Vector Store | Pinecone Free Tier |
