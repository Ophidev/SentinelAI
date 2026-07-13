# 🛡️ SentinelAI

> SentinelAI is an AI-assisted security monitoring app for websites and source code. It checks common misconfigurations, maps findings to the OWASP Top 10, calculates a security score, and explains issues in plain English.

## ✨ What it does

- 🔐 User authentication with JWT and password hashing
- 📁 Multi-project tracking for websites and repositories
- 🔎 Website and code scans for common security issues
- 🧠 AI-powered impact explanations with guardrails and caching

## 🧰 Tech stack

- Frontend: React, Vite, Tailwind CSS, React Router
- Backend: Node.js, Express, MongoDB
- AI: Gemini integration with sanitization and fallback logic

## 🚀 Getting started

### 1. Clone the repository

```bash
git clone https://github.com/Ophidev/SentinelAI.git
cd SentinelAI
```

### 2. Start the backend

```bash
cd server
npm install
npm run dev
```

Create a `.env` file inside the server folder with values such as:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
GEMINI_API_KEY=your_optional_key
```

### 3. Start the frontend

```bash
cd ../client
npm install
npm run dev
```

The frontend will run at http://localhost:5173 and the backend at http://localhost:5000.

## 🧠 Project structure

```text
SentinelAI/
├── client/     # React frontend
├── server/     # Express backend and scan logic
├── docs/       # Design documents
└── README.md
```

## 🔒 Security highlights

- SSRF protection to block private/internal targets
- Deterministic remediation guidance for each finding
- OWASP Top 10 mapping for scan results
- Prompt and output sanitization around AI use

## 📌 Notes

Screenshots and additional visual assets can be added to the project later as the UI evolves.

## ⭐ Support

If you find SentinelAI useful, consider giving the repository a star.
