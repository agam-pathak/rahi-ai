export type Location = {
  name: string;
  lat?: number;
  lng?: number;
  coordinates?: [number, number];
};

export type Activity = {
  id: string;
  title: string;
  location: Location;
  estimated_cost: number;
  order_index: number;
  type?: string;
  duration_minutes?: number;
  tags?: string[];
  verification?: string;
};

export type DayPlan = {
  day_number: number;
  activities: Activity[];
  summary?: string;
};

export type DayStat = {
  day: number;
  count: number;
  cost: number;
  duration: number;
  distance: number;
};

export type GroupPollOption = {
  id: string;
  label: string;
  votes: number;
};

export type GroupPoll = {
  id: string;
  question: string;
  options: GroupPollOption[];
  createdAt: number;
};

export type GroupDecision = {
  id: string;
  text: string;
  done: boolean;
};

export type GroupState = {
  members?: string[];
  polls?: GroupPoll[];
  decisions?: GroupDecision[];
};

export type TripMeta = {
  total_estimated_budget: number;
  pace?: "relaxed" | "balanced" | "packed";
  primary_vibes?: string[];
  packing_suggestions?: string[];
  prep_checklist?: Record<string, boolean>;
  group_state?: GroupState;
  chat_thread?: string[];
  signature_story?: string;
  revision?: number;
  last_saved_at?: string;
};

export type Trip = {
  id?: string;
  destination: string;
  days: DayPlan[];
  meta: TripMeta;
  share_code?: string;
  is_public?: boolean;
};

export type SavedTrip = {
  destination: string;
  daysInput: string;
  budgetInput: string;
  interestsInput: string;
  tripData: Trip;
  time: number;
};

export type WeatherItem = {
  main?: { temp?: number };
  weather?: { description?: string }[];
};

export type VoiceSettings = {
  tts: boolean;
  earcons: boolean;
  autoSend: boolean;
  lang: "en-IN" | "hi-IN";
};

export type GeneratePlanOverrides = {
  destination?: string;
  budget?: string;
  durationInput?: string;
  interests?: string;
};
