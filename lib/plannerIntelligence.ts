export function buildPlannerPrompt({
  destination,
  days,
  budget,
  interests,
}: {
  destination: string;
  days: number;
  budget: number;
  interests: string;
}) {
  return `
You are a professional travel planner AI.

Create a ${days}-day travel itinerary for ${destination} with total budget ₹${budget}.

User interests: ${interests}

STRICT RULES:
1. Generate EXACTLY ${days} days. Not more. Not less.
2. Do NOT repeat any activity across days.
3. Group nearby places in same day logically.
4. Mention transport mode when changing locations.
5. Keep plan realistic for budget travelers.
6. Rotate food types daily.
7. Avoid luxury or imaginary experiences.
8. Validate that total budget fits inside ₹${budget}.
9. Do NOT invent rare activities unless popular locally.

FORMAT STRICTLY:

Day 1:
Morning:
- ...
Afternoon:
- ...
Evening:
- ...
Food:
- Breakfast:
- Lunch:
- Dinner:
Tips:
- ...

Use markdown bullet points.
Keep concise, practical, and realistic.

If something is not possible within budget, replace it with a cheaper local alternative.

Now generate the plan.
`;
}

export function postProcessItinerary(text: string, days: number) {
  if (!text) return null;

  // Trim hallucinated extra days
  const parts = text.split(/Day\s\d+:/gi).filter(Boolean);

  const trimmed = parts.slice(0, days);

  let rebuilt = "";
  trimmed.forEach((d, i) => {
    rebuilt += `Day ${i + 1}:\n${d.trim()}\n\n`;
  });

  return rebuilt.trim();
}
