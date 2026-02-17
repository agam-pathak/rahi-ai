export type TripActivity = {
  id: string;
  title: string;
  type: string;
  estimated_cost: number;
  duration_minutes: number;
  order_index: number;
  verification?: string;
  tags?: string[];
  location?: {
    name?: string;
    lat?: number;
    lng?: number;
  };
};

export type TripDay = {
  day_number: number;
  summary: string;
  activities: TripActivity[];
};

export type TripMeta = {
  total_estimated_budget: number;
  pace?: string;
  primary_vibes?: string[];
  revision?: number;
  last_saved_at?: string;
};

export type TripResult = {
  id: string;
  destination: string;
  days_count: number;
  generated_at: string;
  days: TripDay[];
  meta: TripMeta;
};

export type TripRecord = {
  id: string;
  destination: string;
  days: string;
  budget: string;
  interests: string;
  share_code: string;
  is_public: boolean;
  result: TripResult | string;
  created_at?: string;
  updated_at?: string;
};

export type GenerateTripRequest = {
  destination: string;
  days: number;
  budget: number;
  interests: string;
};

export type GenerateTripResponse = {
  result: TripResult;
  share_code: string;
  trip_id: string | null;
};

