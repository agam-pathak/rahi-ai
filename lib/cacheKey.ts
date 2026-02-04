import crypto from "crypto";

export function buildCacheKey(input: {
  destination: string;
  days: number;
  budget: number;
  interests: string;
}) {
  const raw = `
${input.destination.toLowerCase().trim()}
${input.days}
${input.budget}
${input.interests.toLowerCase().trim()}
`;

  return crypto.createHash("sha256").update(raw).digest("hex");
}
