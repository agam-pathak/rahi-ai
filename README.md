This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment Variables

Create a `.env.local` from the example and fill the values:

```bash
cp .env.example .env.local
```

Required for build + auth:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Required for features:
- `GROQ_API_KEY` (AI)
- `OPENWEATHER_API_KEY` (Weather)
- `NEXT_PUBLIC_MAPBOX_TOKEN` (Maps)

Recommended:
- `SUPABASE_SERVICE_ROLE_KEY` (server-only admin fallback)
- `PREMIUM_ENABLED` / `NEXT_PUBLIC_PREMIUM_ENABLED` (billing flags)

## Supabase RLS

Run the policies in `supabase/rls.sql` from the Supabase SQL editor.

## Monitoring (Sentry)

This project includes Sentry for error monitoring.

Set these env vars in Vercel (Production + Preview if needed):
- `SENTRY_DSN` (server)
- `NEXT_PUBLIC_SENTRY_DSN` (client)
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN` (for source map upload)
- `SENTRY_ENVIRONMENT` (optional, e.g. `production`)

## Deployment (Vercel)

1) Import the repo in Vercel.
2) Set the same environment variables for **Production** (and **Preview** if needed).
3) Deploy. The site URL should be set to the Vercel domain.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
