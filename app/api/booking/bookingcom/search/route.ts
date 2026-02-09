import { NextResponse } from "next/server";
import { getClientId, rateLimit, rateLimitHeaders } from "@/lib/ai/guard";

type StayResult = {
  id: number;
  name: string;
  price?: number;
  currency?: string;
  url?: string;
  deepLinkUrl?: string;
  reviewScore?: number;
  stars?: number;
  reviewCount?: number;
  photoUrl?: string;
  freeCancellation?: boolean;
};

const rawBaseUrl = process.env.BOOKINGCOM_BASE_URL || "https://demandapi.booking.com/3.1";
const BASE_URL = rawBaseUrl.replace(/\/$/, "");
const API_TOKEN = process.env.BOOKINGCOM_API_TOKEN;
const AFFILIATE_ID = process.env.BOOKINGCOM_AFFILIATE_ID;
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const BOOKER = { country: "in", platform: "desktop" } as const;

const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const pickTranslated = (value: any) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const candidate =
      value["en-gb"] ??
      value["en-us"] ??
      value["en"] ??
      (Array.isArray(Object.values(value)) ? Object.values(value)[0] : null);
    return typeof candidate === "string" ? candidate : null;
  }
  return null;
};

const bookingFetch = async (path: string, payload: Record<string, unknown>) => {
  if (!API_TOKEN || !AFFILIATE_ID) {
    throw new Error("Booking.com credentials missing");
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "X-Affiliate-Id": AFFILIATE_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Booking.com request failed");
  }

  return res.json();
};

const geocodeDestination = async (destination: string) => {
  if (!MAPBOX_TOKEN) return null;
  const query = `${destination}, India`;
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?access_token=${MAPBOX_TOKEN}&limit=1`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const center = data?.features?.[0]?.center;
  if (Array.isArray(center) && center.length === 2) {
    return {
      latitude: center[1],
      longitude: center[0],
      radius: 25,
    };
  }
  return null;
};

const extractPrice = (item: any) => {
  const raw =
    item?.recommendation?.price?.book ??
    item?.recommendation?.price?.total ??
    item?.products?.[0]?.price?.book ??
    item?.price?.book ??
    item?.price?.total ??
    null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasFreeCancellation = (item: any) => {
  const products = item?.recommendation?.products ?? item?.products ?? [];
  if (!Array.isArray(products)) return false;
  return products.some(
    (product: any) =>
      product?.policies?.cancellation?.type === "free_cancellation"
  );
};

export async function POST(req: Request) {
  const clientId = getClientId(req);
  const rl = rateLimit(`booking:search:${clientId}`, {
    limit: 20,
    windowMs: 60_000,
  });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rlHeaders }
    );
  }

  if (!API_TOKEN || !AFFILIATE_ID) {
    return NextResponse.json(
      { error: "Booking.com credentials missing" },
      { status: 503, headers: rlHeaders }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rlHeaders }
    );
  }

  const destination =
    typeof body?.destination === "string" ? body.destination.trim() : "";
  const checkIn = typeof body?.checkIn === "string" ? body.checkIn : "";
  const checkOut = typeof body?.checkOut === "string" ? body.checkOut : "";
  const stayType = body?.stayType === "hostels" ? "hostels" : "hotels";
  const adults = normalizeNumber(body?.guests, 2);
  const rooms = normalizeNumber(body?.rooms, 1);

  if (!destination) {
    return NextResponse.json(
      { error: "Destination required" },
      { status: 400, headers: rlHeaders }
    );
  }
  if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
    return NextResponse.json(
      { error: "Check-in and check-out dates required" },
      { status: 400, headers: rlHeaders }
    );
  }

  const coordinates =
    body?.coordinates &&
    Number.isFinite(body?.coordinates?.latitude) &&
    Number.isFinite(body?.coordinates?.longitude)
      ? {
          latitude: Number(body.coordinates.latitude),
          longitude: Number(body.coordinates.longitude),
          radius: Number(body.coordinates.radius || 25),
        }
      : await geocodeDestination(destination);

  if (!coordinates) {
    return NextResponse.json(
      { error: "Unable to resolve destination. Add a specific Indian city." },
      { status: 400, headers: rlHeaders }
    );
  }

  try {
    const searchPayload: Record<string, unknown> = {
      booker: BOOKER,
      checkin: checkIn,
      checkout: checkOut,
      guests: {
        number_of_adults: adults,
        number_of_rooms: rooms,
      },
      rows: 20,
      extras: ["products", "extra_charges"],
      dormitories: stayType === "hostels" ? "only" : "exclude",
      country: "in",
      coordinates,
    };

    const searchData = await bookingFetch("/accommodations/search", searchPayload);
    const items = Array.isArray(searchData?.data) ? searchData.data : [];
    const normalizedItems = items.filter((item: any) =>
      Number.isFinite(Number(item?.id))
    );
    const ids = normalizedItems
      .map((item: any) => Number(item?.id))
      .slice(0, 20);

    const availabilityData = ids.length
      ? await bookingFetch("/accommodations/bulk-availability", {
          accommodations: ids,
          booker: BOOKER,
          checkin: checkIn,
          checkout: checkOut,
          guests: {
            number_of_adults: adults,
            number_of_rooms: rooms,
          },
          extras: ["extra_charges"],
        })
      : null;

    const availabilityMap = new Map<number, any>();
    if (availabilityData?.data && Array.isArray(availabilityData.data)) {
      availabilityData.data.forEach((entry: any) => {
        if (Number.isFinite(entry?.id)) {
          availabilityMap.set(entry.id, entry);
        }
      });
    }

    const results: StayResult[] = normalizedItems.slice(0, 20).map((item: any) => {
      const itemId = Number(item?.id);
      const availability = availabilityMap.get(itemId);
      const name =
        pickTranslated(item?.name) ||
        pickTranslated(item?.hotel_name) ||
        `Stay ${item?.id ?? ""}`.trim();
      const price = extractPrice(availability) ?? extractPrice(item) ?? undefined;
      const currency =
        availability?.currency ||
        item?.currency ||
        item?.price?.currency ||
        undefined;
      const reviewScoreRaw = Number(
        item?.rating?.review_score ?? item?.review_score ?? undefined
      );
      const starsRaw = Number(item?.rating?.stars ?? item?.stars ?? undefined);
      const reviewCountRaw = Number(
        item?.rating?.number_of_reviews ?? item?.review_count ?? undefined
      );
      return {
        id: itemId,
        name,
        price,
        currency,
        url: availability?.url || item?.url || undefined,
        deepLinkUrl: availability?.deep_link_url || item?.deep_link_url || undefined,
        reviewScore: Number.isFinite(reviewScoreRaw) ? reviewScoreRaw : undefined,
        stars: Number.isFinite(starsRaw) ? starsRaw : undefined,
        reviewCount: Number.isFinite(reviewCountRaw) ? reviewCountRaw : undefined,
        photoUrl:
          item?.photos?.[0]?.url ||
          item?.photos?.[0]?.max1280x900 ||
          item?.photo?.url ||
          undefined,
        freeCancellation: hasFreeCancellation(availability) || hasFreeCancellation(item),
      };
    });

    return NextResponse.json({ results }, { headers: rlHeaders });
  } catch (err: any) {
    console.error("Booking.com search error:", err?.message || err);
    return NextResponse.json(
      { error: "Booking.com search failed" },
      { status: 502, headers: rlHeaders }
    );
  }
}
