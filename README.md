# DocuSense AI: Enterprise RAG Chatbot for Secure Company Documents

DocuSense AI is a high-performance, developer-centric Retrieval-Augmented Generation (RAG) Chatbot. It enables teams to upload company documents (PDF, DOCX, TXT) and chat with them securely and contextually. The system features a custom sliding-window chunking engine, hybrid semantic-keyword search, and supports both cloud LLMs (Google Gemini) and local offline LLMs (via Ollama) to ensure enterprise document privacy.

---

## Key Features

- 📑 **Multi-Format Ingestion**: Parse PDFs, DOCX files, and plain text documents seamlessly.
- ⚙️ **Custom Processing Engine**: Token-aware chunking with custom overlaps to maintain paragraph contexts without truncation.
- 🔍 **Hybrid Search & Re-ranking**: Combines semantic embeddings (ChromaDB) with keyword lookup and a BM25 re-ranker.
- 🔒 **Privacy-First (Local LLM Support)**: Toggle between Google Gemini API and a fully offline LLM through Ollama.
- ⏱️ **Latency & Pipeline Metrics**: Dashboard detailing embedding, retrieval, and generation latencies for complete pipeline visibility.
- 📖 **Exact Source Citations**: Inline citations highlighting the exact text chunk extracted from files.

---

## System Architecture

```
                                  +------------------------------------+
                                  |         React & Vite UI            |
                                  |  (Chat Interface, Doc Manager, etc)|
                                  +------------------+-----------------+
                                                     |
                                                     | (REST API / SSE)
                                                     v
                                  +------------------------------------+
                                  |          FastAPI Backend           |
                                  |     (Python 3.10+ / Async routes)  |
                                  +--------+------------------+--------+
                                           |                  |
               +---------------------------+                  +---------------------------+
               | Ingest Pipeline                                                          | Query & Retrieval Pipeline
               v                                                                          v
   +-----------------------+                                                  +-----------------------+
   |   Document Parser     |                                                  |   ChromaDB Client     |
   | (PyPDF / Docx / Text) |                                                  |   (Vector Retrieval)  |
   +-----------+-----------+                                                  +-----------+-----------+
               |                                                                          |
               v                                                                          v
   +-----------------------+                                                  +-----------------------+
   | Custom Window Chunker |                                                  | Hybrid BM25 Re-ranker |
   +-----------+-----------+                                                  +-----------+-----------+
               |                                                                          |
               v                                                                          v
   +-----------------------+                                                  +-----------------------+
   |   Embedding Service   |                                                  |  LLM Generation Engine|
   |   (Gemini & Ollama)   |                                                  |  (Gemini API / Llama3)|
   +-----------+-----------+                                                  +-----------------------+
               |
               v
   +-----------------------+
   |  Vector & Metadata DB |
   |  (ChromaDB + SQLite)  |
   +-----------------------+
```

---

## Directory Structure

```
.
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── api/              # Route controllers (auth, chat, documents)
│   │   ├── core/             # Configuration & DB connection setup
│   │   ├── models/           # SQLAlchemy models (SQLite)
│   │   ├── services/         # RAG pipeline logic (retriever, LLM wrapper)
│   │   ├── utils/            # Custom parser, chunker, and helpers
│   │   └── main.py           # FastAPI entrypoint
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Environment variables template
│
└── frontend/                 # Vite + React Client
    ├── src/
    │   ├── components/       # Chat interface, settings, chunk explorer
    │   ├── hooks/            # Custom react hooks (SSE stream tracker)
    │   ├── styles/           # CSS styles & custom tokens
    │   ├── App.jsx           # Main layout and router
    │   └── main.jsx          # DOM Entrypoint
    ├── package.json          # Node dependencies
    └── vite.config.js        # Vite config
```

---

## Quick Start Setup

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/Scripts/activate # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy environment variables and fill API keys:
   ```bash
   cp .env.example .env
   ```
5. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite server:
   ```bash
   npm run dev
   ```

---

## Author & License
Developed as an engineering portfolio project. MIT License.
