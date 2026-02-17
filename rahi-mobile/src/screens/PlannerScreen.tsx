import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { generateTrip } from "../lib/api";
import type { TripResult } from "../types/trip";

type PlannerScreenProps = {
  accessToken: string | null;
  onTripGenerated: () => void;
};

type Template = {
  id: string;
  title: string;
  destination: string;
  days: number;
  budget: number;
  interests: string;
};

const templates: Template[] = [
  {
    id: "goa",
    title: "Goa Weekend",
    destination: "Goa",
    days: 3,
    budget: 12000,
    interests: "beach, nightlife, cafes, local food",
  },
  {
    id: "manali",
    title: "Manali Adventure",
    destination: "Manali",
    days: 4,
    budget: 15000,
    interests: "trekking, mountains, views, adventure sports",
  },
  {
    id: "jaipur",
    title: "Jaipur Culture",
    destination: "Jaipur",
    days: 3,
    budget: 11000,
    interests: "forts, heritage, local food, markets",
  },
];

const formatInr = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

export function PlannerScreen({ accessToken, onTripGenerated }: PlannerScreenProps) {
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("");
  const [budget, setBudget] = useState("");
  const [interests, setInterests] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trip, setTrip] = useState<TripResult | null>(null);

  const canGenerate = useMemo(() => {
    const dayCount = Number(days);
    const budgetInr = Number(budget);
    return (
      Boolean(accessToken) &&
      destination.trim().length > 1 &&
      interests.trim().length > 3 &&
      Number.isFinite(dayCount) &&
      dayCount > 0 &&
      Number.isFinite(budgetInr) &&
      budgetInr > 0 &&
      !loading
    );
  }, [accessToken, budget, days, destination, interests, loading]);

  const applyTemplate = (template: Template) => {
    setDestination(template.destination);
    setDays(String(template.days));
    setBudget(String(template.budget));
    setInterests(template.interests);
    setTrip(null);
    setError(null);
  };

  const handleGenerate = async () => {
    if (!canGenerate || !accessToken) return;
    setLoading(true);
    setError(null);

    try {
      const payload = {
        destination: destination.trim(),
        days: Number(days),
        budget: Number(budget),
        interests: interests.trim(),
      };

      const response = await generateTrip(payload, accessToken);
      setTrip(response.result);
      onTripGenerated();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate trip right now."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.wrapper}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionLabel}>Trip Builder</Text>
      <Text style={styles.heading}>Design a premium itinerary</Text>

      {!accessToken ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>Please sign in to generate a trip.</Text>
        </View>
      ) : null}

      <View style={styles.templateRow}>
        {templates.map((template) => (
          <Pressable
            key={template.id}
            style={styles.templateCard}
            onPress={() => applyTemplate(template)}
          >
            <Text style={styles.templateTitle}>{template.title}</Text>
            <Text style={styles.templateMeta}>
              {template.days} days • {formatInr(template.budget)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.formCard}>
        <TextInput
          value={destination}
          onChangeText={setDestination}
          placeholder="Destination"
          placeholderTextColor="#8D9BAA"
          style={styles.input}
        />
        <View style={styles.inputRow}>
          <TextInput
            value={days}
            onChangeText={setDays}
            placeholder="Days"
            placeholderTextColor="#8D9BAA"
            keyboardType="numeric"
            style={[styles.input, styles.halfInput]}
          />
          <TextInput
            value={budget}
            onChangeText={setBudget}
            placeholder="Budget in INR"
            placeholderTextColor="#8D9BAA"
            keyboardType="numeric"
            style={[styles.input, styles.halfInput]}
          />
        </View>
        <TextInput
          value={interests}
          onChangeText={setInterests}
          placeholder="Interests (e.g., food, adventure, culture)"
          placeholderTextColor="#8D9BAA"
          style={[styles.input, styles.multiline]}
          multiline
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={[styles.generateButton, !canGenerate && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={!canGenerate}
        >
          {loading ? (
            <ActivityIndicator color="#102132" />
          ) : (
            <Text style={styles.generateText}>Generate trip plan</Text>
          )}
        </Pressable>
      </View>

      {trip ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            {trip.destination} • {trip.days_count} days
          </Text>
          <Text style={styles.resultMeta}>
            Budget: {formatInr(trip.meta.total_estimated_budget || Number(budget))}
          </Text>

          {trip.days.map((day) => (
            <View key={day.day_number} style={styles.dayCard}>
              <Text style={styles.dayTitle}>Day {day.day_number}</Text>
              <Text style={styles.daySummary}>{day.summary}</Text>
              {day.activities.slice(0, 4).map((activity) => (
                <View key={activity.id} style={styles.activityRow}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text style={styles.activityMeta}>
                    {activity.location?.name || "TBD"} • {formatInr(activity.estimated_cost || 0)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  content: {
    paddingBottom: 140,
    gap: 14,
  },
  sectionLabel: {
    color: "#2E6D8D",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontWeight: "700",
    fontSize: 12,
  },
  heading: {
    color: "#10233A",
    fontSize: 30,
    fontFamily: "serif",
    fontWeight: "700",
  },
  noticeCard: {
    borderRadius: 16,
    backgroundColor: "#FFF4E6",
    borderWidth: 1,
    borderColor: "#F3DDBA",
    padding: 12,
  },
  noticeText: {
    color: "#7E5715",
    fontSize: 13,
  },
  templateRow: {
    flexDirection: "row",
    gap: 10,
  },
  templateCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#EFF6FA",
    borderWidth: 1,
    borderColor: "#D6E5EF",
    padding: 10,
  },
  templateTitle: {
    color: "#19324A",
    fontSize: 13,
    fontWeight: "700",
  },
  templateMeta: {
    marginTop: 3,
    color: "#557086",
    fontSize: 12,
  },
  formCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#D3E2EB",
    padding: 14,
    gap: 9,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D4E2EA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#1B3045",
    backgroundColor: "#FBFDFF",
  },
  inputRow: {
    flexDirection: "row",
    gap: 9,
  },
  halfInput: {
    flex: 1,
  },
  multiline: {
    minHeight: 82,
    textAlignVertical: "top",
  },
  errorText: {
    color: "#B73333",
    fontSize: 13,
  },
  generateButton: {
    marginTop: 4,
    borderRadius: 13,
    backgroundColor: "#90D8E4",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  generateButtonDisabled: {
    opacity: 0.55,
  },
  generateText: {
    color: "#112638",
    fontWeight: "700",
    fontSize: 15,
  },
  resultCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#C8DDE8",
    backgroundColor: "#F8FCFF",
    gap: 10,
  },
  resultTitle: {
    color: "#0F2338",
    fontSize: 22,
    fontFamily: "serif",
    fontWeight: "700",
  },
  resultMeta: {
    color: "#4B6176",
    fontSize: 13,
  },
  dayCard: {
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#D8E6EE",
    backgroundColor: "#FFFFFF",
    gap: 6,
  },
  dayTitle: {
    color: "#16334A",
    fontWeight: "700",
    fontSize: 15,
  },
  daySummary: {
    color: "#466179",
    fontSize: 13,
  },
  activityRow: {
    borderTopWidth: 1,
    borderTopColor: "#E8EFF3",
    paddingTop: 6,
  },
  activityTitle: {
    color: "#16334A",
    fontSize: 13,
    fontWeight: "600",
  },
  activityMeta: {
    marginTop: 2,
    color: "#5A7489",
    fontSize: 12,
  },
});

