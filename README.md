# 🎯 TalentScan AI

AI-powered candidate intelligence and resume shortlisting application. Automates resume parsing, candidate scoring, and shortlisting using a multi-agent AI pipeline — no manual screening needed.

## ✨ Features

### Core Capabilities
- **AI Resume Parsing**: Upload resumes in PDF, DOCX, or TXT format for automatic extraction
- **Smart Scoring**: Candidates scored out of 10 based on skills match, experience, and role alignment
- **AI Recommendations**: Automatic Approve/Hold/Reject recommendations
- **Job Description Matching**: Define must-have and nice-to-have skills for intelligent candidate ranking
- **Multi-Provider AI**: Supports both Anthropic Claude and Google Gemini (switchable without restart)

### Data & Reports
- **Private Storage**: Each user's data lives in their own MongoDB Atlas — never shared with anyone else
- **Search & Filter**: Search candidates by name or ID with pagination (50 per page)
- **Professional Exports**: Generate polished Excel and PDF reports with one click
- **Dashboard Analytics**: Real-time summary stats (total, approve/hold/reject rates, average score)
- **Reports Page**: Tabular view of all candidates with search and export capabilities

### User Experience
- **Bring Your Own Database**: Connect your own MongoDB Atlas cluster — your data stays yours
- **Dark/Light Mode**: Toggle between themes with MongoDB Atlas-inspired dark mode
- **Settings Panel**: Configure AI provider, model, and API key (encrypted and stored in your own DB)
- **Live Progress**: Real-time upload progress with active file tracking
- **Responsive Design**: Works across desktop and mobile devices

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript 6.0.3
- **CSS Variables** for theming
- **Web Crypto API** (AES-GCM) for client-side URI obfuscation in localStorage
- **exceljs** for Excel exports
- **jspdf + jspdf-autotable** for PDF exports

### Backend
- **Node.js** with Express server
- **TypeScript 6.0.3** (tsx runtime)
- **MongoDB** — user-provided Atlas cluster (Vercel) or local/self-hosted
- **AES-256-GCM** encryption for API keys at rest

### Deployment
- **Vercel** serverless functions
- **MongoDB Atlas** free tier (M0) — one per user

## 📋 Prerequisites

- **Node.js** 16+ and npm
- **MongoDB** (local or Atlas cluster)
- **API Key** for either:
  - Anthropic Claude API
  - Google Gemini API

## 🚀 Setup

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

> **Note**: `--legacy-peer-deps` is required due to TypeScript 6 compatibility with react-scripts.

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
# App Version
REACT_APP_VERSION=1.2.0

# MongoDB Configuration (self-hosted / local development)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=talentscan

# Encryption Key (32-character hex string) — used to encrypt AI API keys at rest
SETTINGS_ENCRYPTION_KEY=your_32char_hex_key_here
```

**For MongoDB Atlas (self-hosted):**
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net
MONGODB_DB_NAME=talentscan
```

> **Vercel deployment**: `MONGODB_URI` is **not** needed in Vercel environment variables — each visitor connects using their own MongoDB URI entered in the app. Only `MONGODB_DB_NAME`, `SETTINGS_ENCRYPTION_KEY`, and `REACT_APP_VERSION` are required.

### 3. Set Up MongoDB (Self-Hosted / Local)

**Option A: Local MongoDB**
```bash
# Install MongoDB (macOS)
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community

# Verify connection
mongosh talentscan
```

**Option B: MongoDB Atlas (Free Tier)**
1. Create account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free M0 cluster
3. Get connection string and add to `.env`
4. Whitelist your IP address (or `0.0.0.0/0` for Vercel)

### 4. Start the Application

```bash
# Development mode (runs backend + frontend concurrently)
npm start
```

**Access Points:**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 📂 Project Structure

```
talentScanAI/
├── backend/                    # Backend TypeScript code
│   ├── candidateStore.ts       # Candidate CRUD operations
│   ├── settingsStore.ts        # Settings & encryption
│   ├── dbStore.ts              # MongoDB operations (singleton + per-URI)
│   ├── interfaces.ts           # Shared TypeScript interfaces
│   └── server.ts               # Express server with API routes
│
├── api/                        # Vercel serverless functions
│   ├── candidates.ts           # /api/candidates endpoint
│   ├── settings.ts             # /api/settings endpoint
│   ├── reports.ts              # /api/reports endpoint
│   └── ai.ts                   # /api/ai proxy endpoint
│
├── src/                        # Frontend React code
│   ├── agents/                 # AI agent pipeline
│   │   ├── extractionAgent.ts  # Resume extraction
│   │   ├── narrativeAgent.ts   # Candidate narrative
│   │   ├── pipeline.ts         # AI pipeline orchestration
│   │   └── types.ts            # Agent types
│   │
│   ├── TalentScanManager.tsx   # Main dashboard component
│   ├── ReportsPage.tsx         # Reports & exports page
│   ├── JDResumeInput.tsx       # Job description input
│   ├── App.tsx                 # App root & routing
│   ├── interfaces.ts           # Frontend interfaces
│   └── aiResumeParser.ts       # Resume parsing logic
│
├── .env                        # Environment variables
├── package.json                # Dependencies & scripts
├── tsconfig.json               # Frontend TypeScript config
└── vercel.json                 # Vercel deployment config
```

## 🎮 Usage

### 1. Connect Your Database
- On first visit, you'll be prompted to enter your **MongoDB URI**
- Get a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
- Make sure to whitelist `0.0.0.0/0` in Atlas Network Access so Vercel can connect
- Your URI is encrypted (AES-GCM) and stored only in your browser's localStorage — never sent to any shared server

### 2. Configure AI Settings
- Click the ⚙️ settings icon in the header (or it appears automatically after DB setup)
- Choose your AI provider (Anthropic Claude or Google Gemini)
- Select a model and enter your API key
- Your API key is encrypted (AES-256-GCM) and saved to **your own** MongoDB

### 3. Define Job Description
- Enter **must-have skills** (required qualifications)
- Enter **nice-to-have skills** (preferred qualifications)
- Click "Submit JD" to save

### 4. Upload Resumes
- Click "🤖 Upload & Scan Resumes"
- Select multiple PDF, DOCX, or TXT files
- Watch real-time progress as AI processes each resume

### 5. Review Candidates
- View candidates in the **Dashboard** tab
- See AI-generated scores (0-10), recommendations, strengths, and weaknesses
- Manually adjust recommendations (Approve/Hold/Reject)
- Paginated view (2 candidates per page)

### 6. Generate Reports
- Switch to the **Reports** tab
- Search by candidate name or ID
- Export data as Excel or PDF
- Pagination: 50 records per page

## 🔧 Scripts

```bash
# Development
npm start              # Run backend + frontend concurrently
npm run server         # Run backend server only
npm run client         # Run React frontend only

# Production
npm run build          # Build for production (deletes build/, reinstalls, builds)

# Testing
npm test               # Run test suite
```

## 🗄️ Database Schema

### Candidates Collection
```typescript
{
  candidateId: string;          // Auto-generated ID (e.g., "JOHN-A1B2C3D4E5")
  name: string;
  location: string;
  currentRole: string;
  currentCompany: string;
  score: number;                // 0-10
  recommendation: "approve" | "hold" | "reject";
  experiences: unknown[];       // Work experience array
  strengths: unknown[];         // Candidate strengths
  weaknesses: unknown[];        // Candidate weaknesses
  source?: string;              // Default: "ai_scan"
  createdDate?: Date;
  updatedDate?: Date;
}
```

### App Settings Collection
```typescript
{
  _id: "api_settings";
  apiSettings: {
    ai_configured: boolean;
    ai_provider: string;        // "anthropic" | "gemini"
    ai_model: string;
    ai_api_key: string;         // AES-256-GCM encrypted
  };
  createdTime?: Date;
  updatedTime?: Date;
}
```

## 🤖 AI Pipeline

Each resume flows through a hybrid 4-step pipeline:

### 1. **Extraction** (AI)
- Extracts candidate name, location, role, company, experience
- Max 480 output tokens
- Fallback: Rule-based extraction if AI fails

### 2. **Skills Matching** (Deterministic)
- Compares extracted skills against must-have and nice-to-have
- Calculates match percentages
- Identifies missing critical skills

### 3. **Scoring** (Deterministic)
- Score formula: `base + mustHaveBonus + niceToHaveBonus - missingPenalty`
- Normalized to 0-10 scale
- Consistent, reproducible scoring

### 4. **Narrative** (AI)
- Generates strengths and weaknesses bullets
- Max 240 output tokens
- Fallback: Template-based bullets if AI fails

### Recommendation Logic
- **Approve**: Score ≥ 8.0 AND missing must-haves ≤ 1
- **Reject**: Score < 6.0 OR missing must-haves ≥ 3
- **Hold**: Everything else

## 📊 Export Formats

### Excel (.xlsx)
- **Title row**: "TalentScan — Candidate Report" (centered, bold)
- **Timestamp row**: Generated date/time (centered)
- **Headers**: Bold white text on dark blue background
- **Data**: Alternating row colors, centered alignment, borders
- **Columns**: Candidate ID, Name, Current Role, Company, Location, Score, Recommendation

### PDF
- **Title**: Centered "TalentScan — Candidate Report"
- **Timestamp**: Centered generation date/time
- **Table**: Professional layout with alternating row colors
- **Orientation**: Landscape (A4)

## 🔐 Security & Privacy

- **Bring Your Own Database**: Every user connects their own MongoDB Atlas — no data is ever stored in a shared database
- **MongoDB URI in localStorage**: Your connection URI is encrypted with AES-GCM (Web Crypto API) before being stored in your browser. It is sent over HTTPS to Vercel serverless functions per-request and never persisted server-side
- **API Key Encryption**: AI API keys are encrypted with AES-256-GCM (server-side, using `SETTINGS_ENCRYPTION_KEY`) before being saved to your MongoDB
- **No Plaintext Storage**: Neither your MongoDB URI nor your AI API key is ever stored in plaintext anywhere

## 🌐 Deployment (Vercel)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Deploy to Vercel
1. Import project at [vercel.com](https://vercel.com)
2. Add these environment variables:
   - `MONGODB_DB_NAME` — database name (e.g. `talentscan`)
   - `SETTINGS_ENCRYPTION_KEY` — 32-character hex string for encrypting API keys
   - `REACT_APP_VERSION` — app version (e.g. `1.2.0`)
3. Deploy!

> **Note**: `MONGODB_URI` is intentionally **not** set in Vercel. Each visitor provides their own MongoDB URI through the app's setup screen.

### 3. MongoDB Atlas Setup (per user)
1. Create a free Atlas account at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a free M0 cluster
3. In **Network Access**, add `0.0.0.0/0` to allow connections from Vercel
4. Copy the connection string (format: `mongodb+srv://user:pass@cluster.mongodb.net/`)
5. Paste it into the TalentScan AI setup screen on first visit

## 🐛 Troubleshooting

### MongoDB Connection Issues
```bash
# Test local connection
mongosh talentscan

# Check if service is running
brew services list | grep mongodb
```

If using Atlas on Vercel, make sure `0.0.0.0/0` is whitelisted in **Network Access** — Vercel serverless functions use dynamic IPs.

### TypeScript Compilation Errors
```bash
# Check backend
npx tsc --project backend/tsconfig.json --noEmit

# Check frontend
npx tsc --noEmit
```

### API Key Issues
- Verify key is correct in settings panel
- Check `SETTINGS_ENCRYPTION_KEY` in `.env` / Vercel environment
- View encrypted value in your MongoDB: `db.app_settings.findOne()`

### No Candidates Appearing
- Check MongoDB connection (re-enter URI in settings if needed)
- Verify database name in Vercel env (`MONGODB_DB_NAME`)
- Check browser console for errors

## 📝 License

MIT License - see LICENSE file for details

## 👤 Author

**Indranil Chatterjee**
- Version: 1.2.0
- AI Providers: Anthropic Claude · Google Gemini
- Database: MongoDB Atlas (user-provided)
- Frontend: React 18 · TypeScript 6
- Deployment: Vercel

---

**Built with ❤️ using Claude Code**
