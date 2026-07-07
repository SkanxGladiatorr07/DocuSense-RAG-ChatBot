# DocuSense — AI-Powered Enterprise RAG ChatBot

> **Ask questions. Get answers. From your own documents.**

DocuSense is an intelligent, high-performance RAG-powered (Retrieval-Augmented Generation) document assistant. It enables users to upload PDF, DOCX, and TXT documents, automatically index them into a vectorized database, and query their knowledge base in natural language. Every answer is grounded directly in the provided context, cited back to source files, and beautifully rendered in markdown.

---

## ✨ Features

### 📂 Intelligent Ingestion Pipeline
- **Multi-Format Extraction:** Parse PDFs, Word files (DOCX), and plain text files (TXT) seamlessly.
- **Recursive Chunking:** Intelligently splits long documents into paragraph chunks to retain context.
- **Vector Search:** Converts chunks into embeddings and indexes them in MongoDB for sub-second similarity searches.

### 🧠 Gemini & Groq LLM Adapters
- **Gemini Developer API:** Leverages Google's `gemini-2.0-flash` for high-fidelity responses.
- **Groq Cloud Integration:** Swap to LLaMA models at runtime by simply configuring your Groq API key.
- **Token Optimization:** Elevated context windows (12 chunks) and 2048 maximum output tokens for rich, non-truncated answers.

### 🔍 Grounded Answers & Citations
- **Strict Hallucination Prevention:** The model is locked to answer ONLY from the uploaded files.
- **Verifiable Source Citations:** Inline markers link every claim to a specific source file.
- **Rich Markdown Formatting:** Renders headers, lists, code snippets, blockquotes, and tables natively.

### 📝 AI Document Insights
- **Automatic Summary:** Triggers immediately after a document completes indexing. Generates a short summary, detailed summary, key topics, keywords, and dates.
- **Suggested Questions:** Automatically parses key themes and creates clickable suggested questions.

### 💬 Active Workspace & Chat Management
- **Inline Rename Option:** Edit conversation titles on the fly from the sidebar list or the chat workspace header.
- **AI Auto-Naming:** Automatically reads the user's first query and generates a clean 3-4 word title.
- **Chat Archive:** Archive older chats to keep your workspace clutter-free.

### 🔒 User Profiles & Security
- **Secure JWT Auth:** Complete user registration, login, and authorization flow.
- **Profile Customization:** Save personal details like Date of Birth, Employment Status, and Company name.
- **Email Masking Decryption:** Mask email IDs by default (e.g. `an*****@gmail.com`) with an interactive eye toggle to view.

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js v18+
- **Framework:** Express.js
- **Database:** MongoDB + Mongoose
- **Parsers:** `pdf-parse` (PDF), `mammoth` (Word/DOCX)
- **AI REST APIs:** Google Gemini API, Groq REST Client

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **Routing:** React Router v7
- **HTTP Client:** Axios
- **Markdown rendering:** `react-markdown`
- **Iconography:** Google Material Symbols (Rounded)

---

## 📁 Folder Structure

```
RAG ChatBot/
├── backend/                    # Express API Server
│   ├── src/
│   │   ├── config/             # Environment & DB configs
│   │   ├── controllers/        # Express request controllers
│   │   ├── middleware/         # Uploads, rate-limiters, auth, errors
│   │   ├── models/             # Mongoose DB Schemas
│   │   ├── routes/             # API Routers
│   │   ├── services/           # LLM services, Embeddings, chunking, caching
│   │   ├── utils/              # Response wrappers, custom errors, loggers
│   │   ├── app.js              # Application assembly
│   │   └── server.js           # Server startup script
│   └── package.json
│
├── frontend/                   # React + Vite Client
│   ├── src/
│   │   ├── components/         # Navigation, route protectors, loaders
│   │   ├── context/            # AuthContext states & methods
│   │   ├── layouts/            # Shared page shells (MainLayout)
│   │   ├── pages/              # Home, Dashboard, Profile, Register, Login
│   │   ├── routes/             # App routing registry
│   │   └── index.css           # Global typography & layout tokens
│   └── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **MongoDB** (Local instance or MongoDB Atlas Connection URI)

---

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/SkanxGladiatorr07/DocuSense-RAG-ChatBot.git
cd DocuSense-RAG-ChatBot

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install --legacy-peer-deps
```

---

### Step 2: Configure Environment Variables

Create a `.env` file in the `backend/` directory by copying the template:

```bash
cd ../backend
cp .env.example .env
```

Open `backend/.env` and configure:

```ini
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/docusense
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=your_jwt_secret_key_at_least_32_characters
GEMINI_API_KEY=your_google_gemini_api_key
GROQ_API_KEY=your_groq_api_key_optional
```

---

### Step 3: Run the Application

#### Start the Backend Server:
```bash
cd backend
npm run dev
```
The server will boot on `http://localhost:5000`. You can test health at `http://localhost:5000/api/v1/health`.

#### Start the Frontend Client:
In a new terminal window:
```bash
cd frontend
npm run dev
```
The client will start at `http://localhost:3000`.

---

## 🔒 Security & Rate Limiting
DocuSense implements custom Express middleware to protect endpoints:
- **Authentication rate-limiting:** 20 requests per 15 minutes.
- **Chat rate-limiting:** 30 requests per minute.
- **Upload rate-limiting:** 10 requests per 15 minutes.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
