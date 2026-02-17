import type {
  GenerateTripRequest,
  GenerateTripResponse,
  TripRecord,
} from "../types/trip";

const fallbackBaseUrl = "https://rahi-ai.vercel.app";
const configuredBaseUrl =
  process.env.EXPO_PUBLIC_RAHI_API_URL?.trim() || fallbackBaseUrl;

export const apiBaseUrl = configuredBaseUrl.replace(/\/+$/, "");

if (!process.env.EXPO_PUBLIC_RAHI_API_URL) {
  console.warn(
    `EXPO_PUBLIC_RAHI_API_URL not set. Using fallback ${fallbackBaseUrl}.`
  );
}

type RequestOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
  accessToken?: string | null;
};

const parseErrorMessage = async (response: Response) => {
  try {
    const data = await response.json();
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    // no-op
  }
  return `Request failed (${response.status})`;
};

async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as T;
}

export const generateTrip = (payload: GenerateTripRequest, accessToken: string) =>
  apiFetch<GenerateTripResponse>("/api/ai", {
    method: "POST",
    accessToken,
    body: JSON.stringify(payload),
  });

export const fetchTrips = (accessToken: string) =>
  apiFetch<TripRecord[]>("/api/trips", {
    method: "GET",
    accessToken,
  });

export const sendChatMessage = (
  message: string,
  history: string[],
  accessToken: string
) =>
  apiFetch<{ reply: string }>("/api/ai/chat", {
    method: "POST",
    accessToken,
    body: JSON.stringify({
      message,
      history,
    }),
  });

