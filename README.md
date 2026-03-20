# Rahi.AI: The AI Travel Orchestrator

> **Built for travelers who want planning clarity, not planning chaos.**

Rahi.AI is a high-performance, AI-driven travel orchestration platform designed to simplify complex trip planning. It distinguishes itself from generic itinerary generators by focusing on **"Mission-Critical"** travel parameters: Budget Guardrails, Route Confidence, and Safety Buffers.

[![Live Demo](https://img.shields.io/badge/Live-Production-2DD4BF?style=for-the-badge)](https://rahi-ai.vercel.app)

---

## 🛰️ Product Highlights: "Mission Control" for Your Travels

Rahi.AI moves beyond static lists, treating every trip as a series of logistics to be optimized for safety, cost, and speed.

### ✨ Key Features
- **PWA Integration**: Installable on mobile and desktop for offline-ready travel planning.
- **Global State Orchestration**: Migration to Zustand for predictable, high-performance trip management.
- **Smart Itineraries**: Multi-day trip planning with AI-guided suggestions.
- **Live Collaboration**: Shared trip links and group voting for itinerary activities.
- **Voice Intelligence**: Heartfelt AI voice assistant for planning and safety alerts.
- **Budget Tracking**: Real-time spending analysis based on trip choices.

### 🧠 Neural Route Engine
Generate high-fidelity, day-wise itineraries in under 60 seconds. Our engine integrates real-time destination data with user preferences to create actionable plans.

### 🛡️ Budget Guardian & Execution Lanes
- **Budget Guardrail**: AI-tracked spend intelligence that flags potential drift before it happens.
- **Route Confidence**: Real-time probability mapping for smooth transit.
- **Safety Buffer**: Contingency tracking and risk assessment for every leg of your journey.

### 💬 AI Travel Buddy & Voice Concierge
A context-aware planning assistant that remembers your constraints. Combined with a **Voice-First UX**, Rahi allows for hands-free planning on the go.

### 🤝 Seamless Collaboration
- **Shared Mission Control**: Invite friends, manage roles, and co-create itineraries in real-time.
- **Public & Live Pages**: Share your live trip status with family or friends via unique, lightweight public links.

---

## 🛠️ Tech Stack: The Engine Room

Rahi.AI is built on a cutting-edge, low-latency stack designed for production-grade reliability.

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **AI Intelligence**: [Groq LPU Engine](https://groq.com/) for ultra-fast inference & custom AI route handlers.
- **Visuals**: [Framer Motion](https://www.framer.com/motion/) (Motion-safe interactions) + [Tailwind CSS](https://tailwindcss.com/).
- **Mapping**: [Mapbox GL](https://www.mapbox.com/) for high-fidelity, interactive 3D trip surfaces.
- **Data & Auth**: [Supabase](https://supabase.com/) (Next.js SSR implementation) with Row Level Security (RLS).
- **Billing**: Dual-flow integration with [Stripe](https://stripe.com/) (International) and [Razorpay](https://razorpay.com/) (Regional UPI).
- **Observability**: [Sentry](https://sentry.io/) for production-grade error tracking and performance monitoring.

---

## 📂 Project Structure

```text
rahi-ai/
  app/
    page.tsx                    # Public interactive homepage
    login/page.tsx              # Auth + forgot/recovery flows
    planner/page.tsx            # Main planning workspace (Mission Control)
    profile/page.tsx            # User settings & preferences
    trip/[code]/page.tsx        # Shared/public trip dashboard
    trip/[code]/live/page.tsx   # Live trip tracking surface
    api/
      ai/*                      # AI orchestration & weather routes
      billing/*                 # Stripe + UPI payment handlers
      trips/*                   # Trip CRUD & membership logic
      invites/*                 # Invite acceptance & token validation
  components/                   # Reusable UI primitives (RahiVoiceUI, Backgrounds)
  lib/                          # Supabase & shared utility helpers
  supabase/                     # SQL seed files for RLS & schemas
  next.config.ts                # Turbopack & Sentry configuration
```

---

## 🚀 Getting Started

### 1. Installation
```bash
git clone https://github.com/agam-pathak/rahi-ai.git
cd rahi-ai
npm install
```

### 2. Environment Configuration
Copy the template and fill in your keys:
```bash
cp .env.example .env.local
```

| Key Group | Required Variables |
| :--- | :--- |
| **Core** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GROQ_API_KEY`, `WEATHER_API_KEY` |
| **UX & Maps** | `MAPBOX_TOKEN`, `VOICE_ENABLED` |
| **Billing** | `STRIPE_SECRET_KEY`, `RAZORPAY_KEY_ID`, `PREMIUM_ENABLED` (Flag) |
| **Support** | `UPSTASH_REDIS_URL` (Rate limiting), `RESEND_API_KEY` (Email invites) |

### 3. Database Initialization
Run the following SQL files in your Supabase SQL Editor to enable RLS and database functions:
1. `supabase/rls.sql`
2. `supabase/trip_invites.sql`
3. `supabase/trip_owner_guard.sql`

### 4. Local Development
```bash
npm run dev
```
Navigate to `http://localhost:3000` to enter the Mission Control dashboard.

---

## 🏗️ Deployment (Vercel)

1. Set the **Root Directory** to `rahi-ai` (if part of a monorepo/workspace).
2. Configure **Production Environment Variables**.
3. (Optional) Enable **Sentry Build Plugin** by setting `SENTRY_ENABLE_BUILD_PLUGIN=1` for automated source map uploads.

---

## 🛣️ Roadmap

- [ ] **Offline Resilience**: PWA implementation for low-connectivity flight/transit scenarios.
- [ ] **Predictive Pricing**: Integrating historical flight/hotel data into the AI generator.
- [ ] **Multi-Agent Voting**: Real-time collaborative polling on AI-suggested alternatives.

---

## 📄 License & Acknowledgements

Built with ❤️ by **Agam Pathak**. 
Special thanks to the [BuildFast](https://buildfast.ai/) community and the maintainers of Next.js, Supabase, and Framer Motion.

