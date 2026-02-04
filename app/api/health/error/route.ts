export async function GET() {
  throw new Error("Sentry test error: /api/health/error");
}
