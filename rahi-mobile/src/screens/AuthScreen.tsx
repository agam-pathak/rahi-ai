import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { hasSupabaseEnv, supabase } from "../lib/supabase";

type AuthMode = "login" | "signup";

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => email.trim().length > 3 && password.trim().length >= 6 && !loading,
    [email, loading, password]
  );

  const handleAuth = async () => {
    if (!canSubmit) return;
    if (!hasSupabaseEnv) {
      setError(
        "Missing Supabase environment values. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
      );
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password: trimmedPassword,
          })
        : await supabase.auth.signUp({
            email: trimmedEmail,
            password: trimmedPassword,
          });

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setNotice("Account created. Please verify your email, then log in.");
      return;
    }

    setNotice(mode === "signup" ? "Account created. You are now signed in." : null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={styles.hero}>
        <Text style={styles.brand}>Rahi.AI</Text>
        <Text style={styles.headline}>Travel Planner for Mobile</Text>
        <Text style={styles.subline}>
          Sign in to generate, save, and chat through your trip plans.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeButton, mode === "login" && styles.modeButtonActive]}
            onPress={() => {
              setMode("login");
              setError(null);
              setNotice(null);
            }}
          >
            <Text style={[styles.modeText, mode === "login" && styles.modeTextActive]}>
              Login
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === "signup" && styles.modeButtonActive]}
            onPress={() => {
              setMode("signup");
              setError(null);
              setNotice(null);
            }}
          >
            <Text style={[styles.modeText, mode === "signup" && styles.modeTextActive]}>
              Sign up
            </Text>
          </Pressable>
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#8A8A8A"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password (min 6 characters)"
          placeholderTextColor="#8A8A8A"
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Pressable
          onPress={handleAuth}
          disabled={!canSubmit}
          style={[styles.submit, !canSubmit && styles.submitDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#0E1D2E" />
          ) : (
            <Text style={styles.submitText}>
              {mode === "login" ? "Continue" : "Create account"}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  hero: {
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  brand: {
    fontSize: 17,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#236A8A",
    fontWeight: "700",
  },
  headline: {
    marginTop: 6,
    color: "#102239",
    fontSize: 32,
    fontFamily: Platform.select({ ios: "Georgia", android: "serif" }),
    fontWeight: "700",
  },
  subline: {
    marginTop: 8,
    color: "#4B5D73",
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D5E6EE",
    backgroundColor: "rgba(255,255,255,0.86)",
    padding: 18,
    shadowColor: "#4A738A",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  modeRow: {
    flexDirection: "row",
    borderRadius: 16,
    backgroundColor: "#EFF5F8",
    padding: 4,
    marginBottom: 14,
  },
  modeButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  modeText: {
    color: "#5B6B7A",
    fontSize: 14,
    fontWeight: "600",
  },
  modeTextActive: {
    color: "#0E2237",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D7E2EA",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
    backgroundColor: "#FCFEFF",
    color: "#172B41",
  },
  error: {
    marginTop: 10,
    color: "#B92B2B",
    fontSize: 13,
  },
  notice: {
    marginTop: 10,
    color: "#2A6D52",
    fontSize: 13,
  },
  submit: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: "#8ED7E3",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  submitDisabled: {
    opacity: 0.55,
  },
  submitText: {
    color: "#12263F",
    fontWeight: "700",
    fontSize: 15,
  },
});

