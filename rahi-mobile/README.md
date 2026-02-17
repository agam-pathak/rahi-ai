# Rahi Mobile (Expo)

React Native mobile client for Rahi.AI with:
- Supabase auth (email/password)
- Trip generation (`/api/ai`)
- Saved trips (`/api/trips`)
- Concierge chat (`/api/ai/chat`)

## 1) Configure environment

Copy `.env.example` to `.env` and set:

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_RAHI_API_URL=...
```

For local backend dev from Android emulator, use:

```bash
EXPO_PUBLIC_RAHI_API_URL=http://10.0.2.2:3000
```

For iOS simulator:

```bash
EXPO_PUBLIC_RAHI_API_URL=http://localhost:3000
```

## 2) Install and run

```bash
npm install
npm run start
```

## 3) Validate types

```bash
npm run typecheck
```

## Notes

- Backend routes now accept `Authorization: Bearer <access_token>` for mobile requests.
- The app defaults to `https://rahi-ai.vercel.app` if `EXPO_PUBLIC_RAHI_API_URL` is missing.

