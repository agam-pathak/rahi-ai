import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { sendChatMessage } from "../lib/api";

type ChatScreenProps = {
  accessToken: string | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Hi, I am Rahi.AI. Ask for itinerary updates, budget checks, or city tips.",
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function ChatScreen({ accessToken }: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(
    () => Boolean(accessToken) && input.trim().length > 0 && !loading,
    [accessToken, input, loading]
  );

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !accessToken || loading) return;

    const outgoing: ChatMessage = {
      id: createId(),
      role: "user",
      text,
    };

    const currentMessages = [...messages, outgoing];
    const history = currentMessages.slice(-6).map((message) =>
      message.role === "user"
        ? `You: ${message.text}`
        : `Rahi.AI: ${message.text}`
    );

    setMessages(currentMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await sendChatMessage(text, history, accessToken);
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          text: response.reply?.trim() || "No response received.",
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to send message right now."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!accessToken) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Sign in to chat with Rahi.AI.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.select({ ios: "padding", android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 90, android: 0 })}
    >
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>Concierge Chat</Text>
        <Text style={styles.heading}>Ask anything travel</Text>
      </View>

      <ScrollView style={styles.messageScroll} contentContainerStyle={styles.messageContent}>
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.bubble,
              message.role === "user" ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                message.role === "user" ? styles.userBubbleText : styles.assistantBubbleText,
              ]}
            >
              {message.text}
            </Text>
          </View>
        ))}
        {loading ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator color="#2A6E89" />
            <Text style={styles.loaderText}>Rahi.AI is thinking...</Text>
          </View>
        ) : null}
      </ScrollView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask for updates, routes, or food spots..."
          placeholderTextColor="#8C9AA8"
          style={styles.input}
          multiline
        />
        <Pressable
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    paddingBottom: 98,
  },
  header: {
    marginBottom: 12,
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
  messageScroll: {
    flex: 1,
  },
  messageContent: {
    gap: 10,
    paddingBottom: 14,
  },
  bubble: {
    maxWidth: "88%",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#8ED4E1",
    borderWidth: 1,
    borderColor: "#78BFCC",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E6EE",
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userBubbleText: {
    color: "#0E2439",
  },
  assistantBubbleText: {
    color: "#1E3850",
  },
  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  },
  loaderText: {
    color: "#4C6880",
    fontSize: 13,
  },
  errorText: {
    marginTop: 6,
    color: "#B83939",
    fontSize: 13,
  },
  inputRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#D4E2EA",
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#19344A",
    textAlignVertical: "top",
  },
  sendButton: {
    borderRadius: 13,
    backgroundColor: "#90D8E4",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendText: {
    color: "#0F263A",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  emptyText: {
    color: "#4D667B",
    fontSize: 15,
    textAlign: "center",
  },
});

