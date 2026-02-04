export function buildTripPrompt(input: {
  destination: string;
  days: number;
  budget: number;
  interests: string;
  profile?: {
    name?: string | null;
    travel_style?: string | null;
    budget_range?: string | null;
    bio?: string | null;
  } | null;
}) {
  const profileLines: string[] = [];
  if (input.profile?.name) profileLines.push(`Name: ${input.profile.name}`);
  if (input.profile?.travel_style) {
    profileLines.push(`Travel style: ${input.profile.travel_style}`);
  }
  if (input.profile?.budget_range) {
    profileLines.push(`Budget range: ${input.profile.budget_range}`);
  }
  if (input.profile?.bio) profileLines.push(`Bio: ${input.profile.bio}`);
  const profileBlock = profileLines.length
    ? `\nTRAVELER PROFILE:\n${profileLines.join("\n")}\n`
    : "";

  return `
You are NOT a chat assistant.
You are a backend API that outputs JSON.

If you output anything other than valid JSON, the request will FAIL.

TRIP INPUT:
Destination: ${input.destination}
Number of days: ${input.days}
Total budget (INR): ${input.budget}
Interests: ${input.interests}
${profileBlock}

STRICT RULES:
- Return ONLY valid JSON
- Do NOT include markdown, comments, or explanations
- Do NOT omit any required fields
- Use realistic estimates
- All costs must be numbers (INR)

OUTPUT MUST MATCH THIS EXACT JSON SHAPE:

{
  "destination": "${input.destination}",
  "days_count": ${input.days},
  "days": [
    {
      "day_number": 1,
      "summary": "Brief summary of the day",
      "activities": [
        {
          "title": "Activity name",
          "type": "sightseeing | food | transit | rest | experience",
          "location": {
            "name": "Place name",
            "lat": 0,
            "lng": 0
          },
          "estimated_cost": 500,
          "duration_minutes": 90,
          "verification": "ai_estimated",
          "tags": ["cultural"],
          "order_index": 0
        }
      ]
    }
  ],
  "meta": {
    "total_estimated_budget": ${input.budget},
    "pace": "balanced",
    "primary_vibes": ["cultural"]
  }
}

IMPORTANT:
- Each day MUST have 3-6 activities
- Tags must always be an array
- verification must always be "ai_estimated"

Return ONLY JSON.
`;
}
