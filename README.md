# 🏏 CrikeX — India's Smartest Sports Prediction Platform

<div align="center">

![CrikeX Banner](https://img.shields.io/badge/CrikeX-IPL%202026-00FFB2?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0iIzAwRkZCMiIvPjwvc3ZnPg==&labelColor=060A14)

[![Live Demo](https://img.shields.io/badge/🔴_LIVE-crikex--prod--v12345.onrender.com-00FFB2?style=flat-square)](https://crikex-prod-v12345.onrender.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://reactjs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express)](https://expressjs.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?style=flat-square&logo=socket.io)](https://socket.io)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**Predict. Play. Win Big with IPL.**

A free-to-play, real-time IPL prediction platform with live odds, leaderboards, and a gamified coin wallet system.

[Live Demo](https://crikex-prod-v12345.onrender.com) · [Report Bug](https://github.com/codgamerofficial/CrikeX/issues) · [Request Feature](https://github.com/codgamerofficial/CrikeX/issues)

</div>

---

## ⚡ Features

| Feature | Description |
|---------|-------------|
| 🏏 **Live Match Predictions** | Real-time odds powered by a Bayesian probability engine |
| 📊 **Live Score Updates** | WebSocket-powered live scores, overs, and wickets |
| 💰 **Virtual Coin Wallet** | Earn coins via daily login bonuses, referrals, and correct predictions |
| 🏆 **Leaderboard** | Compete for the #1 spot with season-long rankings |
| 🛡️ **Fraud Detection** | AI-powered velocity, stake, and win-rate anomaly detection |
| 🔐 **OTP Authentication** | Phone-based OTP login with JWT sessions |
| 📱 **Mobile-First PWA** | Installable progressive web app with dark premium UI |
| 🤝 **Referral System** | Invite friends, earn bonus coins |
| ⚖️ **Legal Compliance** | Geo-blocking for restricted Indian states, free-to-play only |

---

## 🖼️ Screenshots

<div align="center">
<table>
<tr>
<td align="center"><b>Landing Page</b></td>
<td align="center"><b>Matches Dashboard</b></td>
<td align="center"><b>Leaderboard</b></td>
</tr>
<tr>
<td><img src="https://via.placeholder.com/300x200/060A14/00FFB2?text=Landing" alt="Landing"/></td>
<td><img src="https://via.placeholder.com/300x200/060A14/00FFB2?text=Matches" alt="Matches"/></td>
<td><img src="https://via.placeholder.com/300x200/060A14/00FFB2?text=Leaderboard" alt="Leaderboard"/></td>
</tr>
</table>
</div>

---

## 🛠️ Tech Stack

### Frontend
- **React 18** + React Router v6
- **Vite** — Lightning-fast build tooling
- **Socket.IO Client** — Real-time updates
- **Lucide React** — Premium icon library
- **Custom CSS** — Glassmorphism, neon accents, dark mode

### Backend
- **Express.js** — RESTful API
- **Socket.IO** — WebSocket server
- **JWT** — Stateless authentication
- **Helmet + CORS** — Security hardening
- **Custom Engines:**
  - `OddsEngine` — Bayesian probability model
  - `SettlementEngine` — Market resolution & payouts
  - `FraudDetection` — Behavioral anomaly detection

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### Development

```bash
# Clone the repo
git clone https://github.com/codgamerofficial/CrikeX.git
cd CrikeX

# Install all dependencies
npm run install:all

# Start the dev server (API on :3001)
cd server && npm run dev

# In a new terminal — start the client (UI on :5173)
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
# Build the React client into server/public
cd client && npm run build

# Start the production server
cd ../server
NODE_ENV=production node src/index.js     # Linux/Mac
set "NODE_ENV=production" && node src/index.js  # Windows
```

Open [http://localhost:3001](http://localhost:3001)

---

## 📁 Project Structure

```
CrikeX/
├── client/                    # React Frontend (Vite)
│   ├── public/                # Static assets, manifest, favicon
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── AuthModal.jsx  # OTP login/signup modal
│   │   │   ├── BottomNav.jsx  # Mobile bottom navigation
│   │   │   ├── FloatingBetSlip.jsx
│   │   │   └── TopBar.jsx     # Header with navigation
│   │   ├── context/           # React Context providers
│   │   │   └── AuthContext.jsx
│   │   ├── pages/             # Route pages
│   │   │   ├── Landing.jsx    # Hero + features
│   │   │   ├── Dashboard.jsx  # Match listings
│   │   │   ├── MatchDetail.jsx # Live match + prediction
│   │   │   ├── Wallet.jsx     # Coin balance & transactions
│   │   │   ├── Leaderboard.jsx # Rankings
│   │   │   ├── Profile.jsx    # User profile & KYC
│   │   │   ├── Referral.jsx   # Referral system
│   │   │   └── NotFound.jsx   # 404 page
│   │   ├── services/api.js    # API client
│   │   ├── index.css          # Global design system
│   │   └── main.jsx           # App entry point
│   └── vite.config.js
│
├── server/                    # Express Backend
│   ├── src/
│   │   ├── config/constants.js # App constants & env
│   │   ├── data/store.js      # In-memory data store
│   │   ├── middleware/
│   │   │   ├── auth.js        # JWT verification
│   │   │   ├── geoBlock.js    # State-level geo restriction
│   │   │   └── rateLimiter.js # API rate limiting
│   │   ├── routes/
│   │   │   ├── auth.js        # OTP login/signup
│   │   │   ├── matches.js     # Match CRUD
│   │   │   ├── predictions.js # Bet placement
│   │   │   ├── wallet.js      # Coin transactions
│   │   │   ├── leaderboard.js # Rankings
│   │   │   ├── admin.js       # Admin panel API
│   │   │   ├── referrals.js   # Referral system
│   │   │   └── users.js       # User management
│   │   ├── services/
│   │   │   ├── oddsEngine.js     # Bayesian odds calculator
│   │   │   ├── settlementEngine.js # Market settlement
│   │   │   ├── fraudDetection.js  # Anomaly detection
│   │   │   └── redis.js          # Cache layer
│   │   ├── utils/logger.js    # Structured logging
│   │   ├── websocket/handler.js # Real-time events
│   │   └── index.js           # Server entry point
│   └── .env                   # Environment variables
│
├── render.yaml                # Render.com deploy blueprint
├── package.json               # Monorepo scripts
└── .gitignore
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/send-otp` | Send OTP to phone number |
| `POST` | `/api/v1/auth/verify-otp` | Verify OTP & get JWT |
| `GET` | `/api/v1/matches` | List all matches |
| `GET` | `/api/v1/matches/:id` | Match details + markets |
| `POST` | `/api/v1/predictions` | Place a prediction |
| `GET` | `/api/v1/predictions/my` | User's predictions |
| `GET` | `/api/v1/wallet` | Wallet balance |
| `POST` | `/api/v1/wallet/daily-bonus` | Claim daily login bonus |
| `GET` | `/api/v1/leaderboard` | Season rankings |
| `GET` | `/api/v1/referrals/my` | Referral info & code |
| `GET` | `/api/health` | Health check |

---

## 🌍 Deployment

### Render.com (Recommended)

1. Fork this repo
2. Go to [render.com](https://render.com) → **New** → **Blueprint**
3. Connect your GitHub and select `CrikeX`
4. `render.yaml` auto-configures everything
5. Your app is live! 🎉

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | `production` or `development` | `development` |
| `PORT` | Server port | `3001` |
| `JWT_SECRET` | JWT signing key (use a strong random string) | — |
| `CORS_ORIGIN` | Allowed CORS origin | `*` |

---

## ⚖️ Legal & Compliance

- ✅ **Free-to-play only** — No real money involved
- ✅ **Virtual coins** — Non-transferable, no cash value
- ✅ **Geo-blocking** — Restricted in states: AP, TG, AS, SK, NL
- ✅ **Skill-based** — Predictions require cricket knowledge
- ✅ **Age verification** — KYC system for responsible gaming

---

## 📝 License

This project is licensed under the MIT License.

---

<div align="center">
<b>Made with 🏏 in India</b>
<br/>
<sub>Built for IPL 2026 Season</sub>
</div>
