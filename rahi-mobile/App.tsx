import "react-native-url-polyfill/auto";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "./src/lib/supabase";
import { AuthScreen } from "./src/screens/AuthScreen";
import { PlannerScreen } from "./src/screens/PlannerScreen";
import { TripsScreen } from "./src/screens/TripsScreen";
import { ChatScreen } from "./src/screens/ChatScreen";

type TabKey = "planner" | "trips" | "chat";

const tabs: { key: TabKey; label: string }[] = [
  { key: "planner", label: "Planner" },
  { key: "trips", label: "Trips" },
  { key: "chat", label: "Chat" },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("planner");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setBooting(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setActiveTab("planner");
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
  };

  if (booting) {
    return (
      <SafeAreaView style={styles.bootScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator color="#2E6D8D" size="large" />
        <Text style={styles.bootText}>Loading Rahi.AI Mobile...</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.authRoot}>
        <StatusBar style="dark" />
        <View style={[styles.blob, styles.blobTop]} />
        <View style={[styles.blob, styles.blobBottom]} />
        <AuthScreen />
      </SafeAreaView>
    );
  }

  const accessToken = session.access_token;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Rahi.AI</Text>
          <Text style={styles.userEmail}>{session.user.email || "Traveler"}</Text>
        </View>
        <Pressable
          style={[styles.signOutButton, signingOut && styles.signOutButtonDisabled]}
          disabled={signingOut}
          onPress={() => void handleSignOut()}
        >
          <Text style={styles.signOutText}>{signingOut ? "..." : "Sign out"}</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {activeTab === "planner" ? (
          <PlannerScreen
            accessToken={accessToken}
            onTripGenerated={() => setRefreshVersion((value) => value + 1)}
          />
        ) : null}
        {activeTab === "trips" ? (
          <TripsScreen accessToken={accessToken} refreshVersion={refreshVersion} />
        ) : null}
        {activeTab === "chat" ? <ChatScreen accessToken={accessToken} /> : null}
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const selected = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabButton, selected && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3FAFF",
    gap: 10,
  },
  bootText: {
    color: "#2E5870",
    fontSize: 14,
  },
  authRoot: {
    flex: 1,
    backgroundColor: "#EDF7FC",
    overflow: "hidden",
  },
  root: {
    flex: 1,
    backgroundColor: "#EDF7FC",
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    borderRadius: 500,
    opacity: 0.5,
  },
  blobTop: {
    width: 320,
    height: 320,
    backgroundColor: "#B7E8F0",
    top: -120,
    right: -100,
  },
  blobBottom: {
    width: 300,
    height: 300,
    backgroundColor: "#FFECC4",
    bottom: -120,
    left: -90,
  },
  header: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: "#D6E6EE",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: "#17344F",
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "serif",
  },
  userEmail: {
    marginTop: 2,
    color: "#507089",
    fontSize: 12,
  },
  signOutButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C7DCE7",
    backgroundColor: "#F4FBFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  signOutButtonDisabled: {
    opacity: 0.55,
  },
  signOutText: {
    color: "#244663",
    fontSize: 12,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 6,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D2E3EC",
    backgroundColor: "rgba(255,255,255,0.86)",
    padding: 5,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  tabButtonActive: {
    backgroundColor: "#9EDDE8",
  },
  tabText: {
    color: "#4D6A80",
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#12293E",
  },
});
