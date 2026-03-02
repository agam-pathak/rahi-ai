# Rahi.AI

AI-powered travel planning platform built with Next.js, Supabase, and a voice-first UX.

Rahi.AI helps users generate trip itineraries, track budgets, collaborate on shared plans, and access premium planning features through Stripe and UPI billing paths.

## Live

- Production: https://rahi-ai.vercel.app

## Product Highlights

- AI Trip Planner with day-wise itinerary generation
- Budget Guardian with spending controls and premium gating
- AI Travel Buddy (chat-first planning assistant)
- Voice Concierge on home and planner surfaces
- Auth flows: email/password, Google OAuth, forgot password, recovery mode reset
- Collaborative trip sharing and invite acceptance
- Public trip links and live trip pages
- Billing support for Stripe subscriptions and UPI checkout flow

## Recent Updates

- Premium login redesign with improved motion and recovery UX
- Forgot password + recovery mode implementation (`/login?mode=recovery`)
- Homepage hardening pass:
  - public-safe home behavior
  - guarded planner redirects for unauthenticated users
  - improved profile menu accessibility
  - motion fallback for reduced-motion users
- Robust avatar fallback to initials when profile image fails
- Sentry build plugin gated behind explicit env toggle for deployment stability

## Tech Stack

- Framework: Next.js 16 (App Router, Turbopack)
- Language: TypeScript
- UI: React 18, Tailwind CSS, Framer Motion, Lucide icons
- Auth + DB: Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- AI: Groq-backed API routes
- Maps: Mapbox GL
- Billing: Stripe + Razorpay UPI flow
- Monitoring: Sentry
- Testing: Playwright (visual tests)

## Project Structure

```text
rahi-ai/
  app/
    page.tsx                    # Public homepage
    login/page.tsx              # Auth + forgot/recovery flows
    planner/page.tsx            # Main planning workspace
    profile/page.tsx            # User profile
    trip/[code]/page.tsx        # Shared/public trip page
    trip/[code]/live/page.tsx   # Live trip page
    api/
      ai/*                      # AI route handlers
      billing/*                 # Stripe + UPI routes
      trips/*                   # Trip CRUD and membership
      invites/*                 # Invite acceptance
  components/
    RahiBackground.tsx
    RahiVoiceUI.tsx
  lib/
    supabase/*                  # Client/server/admin Supabase helpers
  supabase/
    rls.sql
    trip_invites.sql
    trip_owner_guard.sql
  proxy.ts                      # Session refresh middleware/proxy
  next.config.ts                # Next config + optional Sentry plugin wrapper
```

## Getting Started

### 1. Install

```bash
cd rahi-ai
npm install
```

### 2. Configure env

```bash
cp .env.example .env.local
```

Fill required variables (see section below).

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000

### 4. Build check

```bash
npm run build
```

## Environment Variables

Use `.env.example` as your base. Below is the practical grouping used in code.

### Core required

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `GROQ_API_KEY`
- `WEATHER_API_KEY`

Notes:
- Weather route currently reads `WEATHER_API_KEY`.
- If your local template still has `OPENWEATHER_API_KEY`, add `WEATHER_API_KEY` as well.

### Maps and UX

- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `NEXT_PUBLIC_VOICE_ENABLED`

### Supabase admin / server features

- `SUPABASE_SERVICE_ROLE_KEY`

### Premium and billing flags

- `PREMIUM_ENABLED`
- `NEXT_PUBLIC_PREMIUM_ENABLED`
- `BASIC_TRIAL_DAYS`

### Stripe billing

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID` (legacy fallback)
- `STRIPE_PRICE_ID_PREMIUM`
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRODUCT_ID_PRO`
- `STRIPE_WEBHOOK_SECRET`

### UPI billing (Razorpay)

- `UPI_ENABLED`
- `NEXT_PUBLIC_UPI_ENABLED`
- `UPI_PLAN_NAME`
- `UPI_PLAN_AMOUNT_INR`
- `NEXT_PUBLIC_UPI_PLAN_AMOUNT_INR`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

### AI guard/rate limiting

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Optional email invite support

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_EMAIL_INVITES_ENABLED`

### Observability (Sentry)

- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_ENABLE_BUILD_PLUGIN`

`SENTRY_ENABLE_BUILD_PLUGIN=1` enables `withSentryConfig(...)` wrapping in `next.config.ts`. By default, plugin wrapping is off unless this flag is set.

## Supabase Setup

Run SQL files in Supabase SQL editor:

1. `supabase/rls.sql`
2. `supabase/trip_invites.sql`
3. `supabase/trip_owner_guard.sql`

This enables RLS and core collaboration policies for trips, members, and profiles.

## Auth Recovery Setup (Important)

For forgot-password recovery links to work, add these redirect URLs in Supabase Auth settings:

- `https://rahi-ai.vercel.app/login?mode=recovery`
- `http://localhost:3000/login?mode=recovery`

The login page handles recovery mode and password update directly.

## Scripts

- `npm run dev` - Start local dev server
- `npm run build` - Production build
- `npm run start` - Start production server
- `npm run test:visual` - Run Playwright visual tests
- `npm run test:visual:update` - Update visual snapshots

## Deployment (Vercel)

1. Import repo into Vercel.
2. Set project root to `rahi-ai` (if using a parent workspace).
3. Add all required env vars for Production (and Preview if needed).
4. Deploy.

If enabling Sentry build-time source map upload, set `SENTRY_ENABLE_BUILD_PLUGIN=1` and ensure Sentry org/project/token vars are configured.

## API Overview (High-Level)

- `app/api/ai/*` - itinerary generation, chat, daily plans, weather, stream
- `app/api/billing/*` - checkout, portal, webhooks, UPI initiate/status, waitlist
- `app/api/trips/*` - trip CRUD, member management, invite issuance
- `app/api/invites/[token]/accept` - invite acceptance flow
- `app/api/users/lookup` - user lookup helper

## Security Notes

- Never commit `.env.local` or any secret key.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, Stripe, Razorpay, and Redis tokens server-only.
- Ensure RLS policies are applied before exposing the app broadly.

## Roadmap (Practical)

- Convert heavy media assets to optimized WebP/AVIF variants
- Break large route files into smaller feature modules
- Expand keyboard accessibility coverage in dropdown/menus
- Add end-to-end smoke tests for login -> planner recovery and billing flows

## Acknowledgements

- Next.js, Supabase, Stripe, Razorpay, Mapbox, Framer Motion, Lucide, Playwright

---

Built for travelers who want planning clarity, not planning chaos.
