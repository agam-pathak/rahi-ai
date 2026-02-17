import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchTrips } from "../lib/api";
import type { TripDay, TripRecord, TripResult } from "../types/trip";

type TripsScreenProps = {
  accessToken: string | null;
  refreshVersion: number;
};

const formatInr = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

const parseTripResult = (
  value: TripRecord["result"] | null | undefined
): TripResult | null => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as TripResult;
    } catch {
      return null;
    }
  }
  return value;
};

export function TripsScreen({ accessToken, refreshVersion }: TripsScreenProps) {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    if (!accessToken) {
      setTrips([]);
      setSelectedTripId(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetchTrips(accessToken);
      setTrips(response);
      if (!selectedTripId && response.length > 0) {
        setSelectedTripId(response[0].id);
      }
      if (selectedTripId && !response.find((trip) => trip.id === selectedTripId)) {
        setSelectedTripId(response[0]?.id ?? null);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load trips right now."
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedTripId]);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips, refreshVersion]);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [selectedTripId, trips]
  );
  const selectedResult = parseTripResult(selectedTrip?.result ?? null);
  const selectedDays: TripDay[] = selectedResult?.days ?? [];

  if (!accessToken) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>Sign in to view your saved trips.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.wrapper}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.sectionLabel}>Trips</Text>
          <Text style={styles.heading}>Your saved journeys</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={() => void loadTrips()}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loaderRow}>
          <ActivityIndicator color="#1E5D7A" />
          <Text style={styles.loaderText}>Loading trips...</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {trips.length === 0 && !loading ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardText}>No trips yet. Generate your first plan.</Text>
        </View>
      ) : null}

      {trips.map((trip) => {
        const result = parseTripResult(trip.result);
        const estimatedBudget =
          result?.meta?.total_estimated_budget ?? Number(trip.budget ?? 0);
        const dayCount = result?.days_count ?? Number(trip.days ?? 0);
        const selected = trip.id === selectedTripId;

        return (
          <Pressable
            key={trip.id}
            style={[styles.tripCard, selected && styles.tripCardSelected]}
            onPress={() => setSelectedTripId(trip.id)}
          >
            <Text style={styles.tripTitle}>{trip.destination}</Text>
            <Text style={styles.tripMeta}>
              {dayCount} days • {formatInr(estimatedBudget)}
            </Text>
            <Text style={styles.tripSubMeta}>
              {trip.is_public ? "Public link enabled" : "Private trip"} • #{trip.share_code}
            </Text>
          </Pressable>
        );
      })}

      {selectedTrip && selectedResult ? (
        <View style={styles.detailCard}>
          <Text style={styles.detailHeading}>Trip preview</Text>
          {selectedDays.map((day) => (
            <View key={day.day_number} style={styles.dayBlock}>
              <Text style={styles.dayTitle}>Day {day.day_number}</Text>
              <Text style={styles.daySummary}>{day.summary}</Text>
              {day.activities.slice(0, 3).map((activity) => (
                <Text key={activity.id} style={styles.activityLine}>
                  • {activity.title}
                </Text>
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
    gap: 12,
    paddingBottom: 140,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  refreshButton: {
    borderRadius: 12,
    backgroundColor: "#EAF4FA",
    borderWidth: 1,
    borderColor: "#C9DFEA",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshText: {
    color: "#183954",
    fontWeight: "700",
    fontSize: 12,
  },
  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  },
  loaderText: {
    color: "#4E687E",
    fontSize: 13,
  },
  errorText: {
    color: "#B63636",
    fontSize: 13,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2D4B1",
    backgroundColor: "#FFF8E9",
    padding: 12,
  },
  emptyCardText: {
    color: "#7A5A20",
    fontSize: 13,
  },
  tripCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D2E2EC",
    backgroundColor: "rgba(255,255,255,0.88)",
    padding: 12,
    gap: 3,
  },
  tripCardSelected: {
    borderColor: "#7CBED3",
    backgroundColor: "#F2FAFD",
  },
  tripTitle: {
    color: "#123048",
    fontSize: 17,
    fontWeight: "700",
  },
  tripMeta: {
    color: "#49657D",
    fontSize: 13,
  },
  tripSubMeta: {
    color: "#68839A",
    fontSize: 12,
  },
  detailCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#CADFEB",
    backgroundColor: "#F8FCFF",
    padding: 12,
    gap: 10,
  },
  detailHeading: {
    color: "#12334D",
    fontSize: 19,
    fontWeight: "700",
    fontFamily: "serif",
  },
  dayBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DEEAF2",
    backgroundColor: "#FFFFFF",
    padding: 10,
    gap: 4,
  },
  dayTitle: {
    color: "#1A3C55",
    fontSize: 14,
    fontWeight: "700",
  },
  daySummary: {
    color: "#4A647B",
    fontSize: 12,
  },
  activityLine: {
    color: "#2A4D66",
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  emptyStateText: {
    color: "#4D667B",
    fontSize: 15,
    textAlign: "center",
  },
});
