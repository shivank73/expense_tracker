# CashCue 💸

A premium, high-performance personal finance and wealth management ecosystem. CashCue is a full-stack SaaS application built to provide structural financial stability through automated tracking, budget enforcement, and AI-driven cashflow diagnostics. Designed with a flawless Apple-tier OLED dark-mode aesthetic.

## ✨ Core Features

* **Unified Dashboard:** Real-time net balance calculations, income vs. expenses visual area charts, and a detailed month-wise transaction ledger.
* **Smart Budgets:** Track spending limits by category with dynamic, interactive SVG budget rings and linear progress bars.
* **Autopilot Command:** Never miss a payment. Manage recurring subscriptions, track utility bills, and manage borrowed/lent debts with automated 7-day upcoming warnings and AI-generated financial briefs.
* **Portfolio & Assets:** Monitor liquid cash, bank accounts, tangible assets, and real estate. Includes a custom 28-day "LeetCode-style" heatmap for tracking freelance and passive income yields.
* **Financial Goals:** Set, track, and manage long-term financial milestones and savings targets with visual progress indicators.
* **Global Settings & Customization:** Configure your base currency, manage custom income/expense category tags, and control the unified aesthetic engine.
* **Enterprise Security:** Fully secured private routing protected by invisible JSON Web Tokens (JWT).

## 🛠️ Tech Stack (PERN)

**Frontend (UI & Routing):**
* React.js (Vite)
* React Router DOM (v6)
* Recharts (Data Visualization)
* Axios (HTTP Client)
* Custom CSS (Apple-style design system, CSS variables)

**Backend (API & Auth):**
* Node.js & Express.js
* JSON Web Tokens (JWT) for secure authentication
* Prisma ORM

**Database & Cloud Deployment:**
* **Database:** PostgreSQL (Hosted on [Neon.tech](https://neon.tech/))
* **Frontend Hosting:** [Vercel](https://vercel.com/)
* **Backend Hosting:** [Render](https://render.com/)

---

## 🚀 Local Development Setup

### Prerequisites
* Node.js (v16 or higher)
* A PostgreSQL database (e.g., Neon.tech)

### 1. Clone the Repository
```bash
git clone [https://github.com/your-username/expense_tracker.git](https://github.com/your-username/expense_tracker.git)
cd expense_tracker
```

### 2. Backend Setup
Navigate to the server directory and install dependencies:
```bash
cd server
npm install
```

Create a `.env` file in the `server` root and add your secure keys:
```env
DATABASE_URL="postgresql://[user]:[password]@[neon-hostname]/[dbname]?sslmode=require"
JWT_SECRET="your_generated_cryptographic_secret"
PORT=3000
```

Push the Prisma schema to your database and start the server:
```bash
npx prisma db push
node server.js
```

### 3. Frontend Setup
Open a new terminal window, navigate to the client directory, and install dependencies:
```bash
cd client
npm install
```

Start the Vite development server:
```bash
npm run dev
```

---

## 🌍 Deployment Architecture

This mono-repo is designed for a split-deployment Serverless architecture:
* **Frontend (Vercel):** The `client` folder is deployed to Vercel. A `vercel.json` file is included to configure URL rewrites, ensuring React Router DOM's Single Page Application (SPA) routing functions flawlessly on the live internet.
* **Backend (Render):** The `server` folder is deployed as a Web Service on Render, maintaining a persistent connection to the Neon PostgreSQL database.

## 📄 License
This project is licensed under the MIT License.
