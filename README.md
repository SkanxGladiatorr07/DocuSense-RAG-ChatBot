# DocuSense — RAG ChatBot for Company Documents

> **Ask questions. Get answers. From your own documents.**

DocuSense is an intelligent, RAG-powered (Retrieval-Augmented Generation) chatbot that lets employees query internal company documents using natural language. Instead of searching through folders of PDFs, just ask a question and get a grounded, cited answer — instantly.

---

## Problem Statement

Companies accumulate enormous amounts of internal knowledge — policies, HR manuals, technical specs, onboarding guides, and SOPs — stored across disconnected files and folders. Employees waste time hunting for information, and tribal knowledge is lost when people leave.

DocuSense solves this by turning your document library into a conversational knowledge base. Upload a file, ask a question, get an answer.

---

## Planned Features

| Feature | Status |
|---|---|
| Express REST API | ✅ Complete |
| MongoDB Integration | ✅ Complete |
| React + Vite Frontend | ✅ Complete |
| Document Upload (PDF, DOCX, TXT) | 🔜 Planned |
| Text Chunking & Embedding Pipeline | 🔜 Planned |
| Vector Store Integration (Pinecone / ChromaDB) | 🔜 Planned |
| OpenAI GPT Chat Completion | 🔜 Planned |
| Streaming Responses | 🔜 Planned |
| Source Citation in Answers | 🔜 Planned |
| Chat History (per session) | 🔜 Planned |
| Authentication (JWT) | 🔜 Planned |
| Multi-user / Role-based Access | 🔜 Planned |

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js v18+ |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| AI Orchestration | LangChain.js *(planned)* |
| Embeddings | OpenAI `text-embedding-ada-002` *(planned)* |
| Vector Store | Pinecone / ChromaDB *(planned)* |
| LLM | OpenAI GPT-4o *(planned)* |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build Tool | Vite |
| Routing | React Router DOM v7 |
| HTTP Client | Axios |
| Styling | Vanilla CSS + CSS Modules |

---

## Folder Structure

```
RAG ChatBot/
├── backend/                    # Express API server
│   ├── src/
│   │   ├── config/             # DB connection, env config
│   │   ├── controllers/        # Route handler functions
│   │   ├── middleware/         # Error handler, 404, auth (future)
│   │   ├── models/             # Mongoose schemas
│   │   ├── routes/             # Express routers
│   │   ├── services/           # Business logic, AI pipeline
│   │   ├── utils/              # ApiError, ApiResponse, logger
│   │   ├── app.js              # Express app factory
│   │   └── server.js           # HTTP server entry point
│   ├── .env.example
│   └── package.json
│
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── assets/             # Static assets
│   │   ├── components/         # Reusable UI components (Navbar, etc.)
│   │   ├── hooks/              # Custom React hooks (useApi, etc.)
│   │   ├── layouts/            # Shared page shells (MainLayout)
│   │   ├── pages/              # Page-level components (Home, Dashboard)
│   │   ├── routes/             # React Router config
│   │   ├── services/           # Axios API service modules
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── .env.example
│   └── package.json
│
└── docs/
    └── architecture.md         # System architecture deep-dive
```

---

## Development Roadmap

### Phase 1 — Foundation ✅
- [x] Express server with health check
- [x] MongoDB connection (Mongoose)
- [x] Global error handling middleware
- [x] React + Vite frontend scaffold
- [x] React Router with MainLayout
- [x] Navbar, Home page, Dashboard placeholder

### Phase 2 — Document Pipeline 🔜
- [ ] File upload endpoint (Multer)
- [ ] PDF / DOCX text extraction (pdf-parse, mammoth)
- [ ] Recursive text chunking
- [ ] OpenAI embedding generation
- [ ] Vector upsert to Pinecone / ChromaDB
- [ ] Document model in MongoDB

### Phase 3 — Chat & RAG 🔜
- [ ] Chat session model
- [ ] `/api/v1/chat` POST endpoint
- [ ] Retrieval: embed query → vector similarity search
- [ ] Augmentation: inject retrieved chunks into prompt
- [ ] LLM call with LangChain
- [ ] Streaming response via Server-Sent Events
- [ ] Source citation in response payload

### Phase 4 — Auth & Polish 🔜
- [ ] JWT authentication (register / login)
- [ ] Protected routes on frontend
- [ ] Chat history persistence
- [ ] Document management UI
- [ ] Deployment (Railway / Render + Vercel)

---

## Getting Started

### Prerequisites
- **Node.js** v18 or higher
- **MongoDB** running locally (`mongod`) or a MongoDB Atlas URI
- **Git**

### 1. Clone the repository

```bash
git clone https://github.com/your-username/docusense-rag-chatbot.git
cd docusense-rag-chatbot
```

### 2. Setup the Backend

```bash
cd backend

# Install dependencies
npm install

# Copy the environment template and fill in values
cp .env.example .env

# Start the development server
npm run dev
```

The API will start at **http://localhost:5000**  
Health check: `GET http://localhost:5000/` → `{ "success": true, "message": "API Running" }`

### 3. Setup the Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Copy the environment template
cp .env.example .env

# Start the Vite dev server
npm run dev
```

The app will open at **http://localhost:3000**

### 4. Verify both are running

| Service | URL |
|---|---|
| React Frontend | http://localhost:3000 |
| Express API | http://localhost:5000 |
| API Health Check | http://localhost:5000/api/v1/ |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `PORT` | Express server port | `5000` |
| `NODE_ENV` | Runtime environment | `development` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/docusense` |
| `CORS_ORIGIN` | Allowed frontend origin(s) | `http://localhost:3000` |
| `OPENAI_API_KEY` | OpenAI API key *(Phase 3)* | `sk-...` |
| `PINECONE_API_KEY` | Pinecone API key *(Phase 3)* | `...` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API base path | `/api/v1` |

---

## Contributing

Pull requests are welcome. Please open an issue first to discuss what you would like to change.

---

## License

[MIT](LICENSE)

# Made as a Project
