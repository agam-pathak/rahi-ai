"use client";

import type { Dispatch, ReactNode, Ref, SetStateAction } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { MessageSquare, Send, Settings, Sparkles } from "lucide-react";
import RahiVoiceUI from "@/components/RahiVoiceUI";
import type { VoiceSettings } from "../types";

type VoiceStatus = "idle" | "listening" | "thinking" | "speaking";

type Props = {
  glassPanel: string;
  premiumEase: readonly [number, number, number, number];
  chatMessages: string[];
  typing: boolean;
  chatInput: string;
  setChatInput: (value: string) => void;
  sendChat: (overrideText?: string, source?: "text" | "voice") => void | Promise<void>;
  looksLikeItinerary: (text: string) => boolean;
  syncFieldsFromChat: (text: string) => void;
  onSwitchToPlannerMode: () => void;
  voiceSettingsOpen: boolean;
  setVoiceSettingsOpen: Dispatch<SetStateAction<boolean>>;
  voiceSettingsContent: ReactNode;
  handleVoiceCommand: (text: string) => boolean;
  setListening: Dispatch<SetStateAction<boolean>>;
  setVoiceStatus: Dispatch<SetStateAction<VoiceStatus>>;
  voiceStatus: VoiceStatus;
  voiceSettings: VoiceSettings;
  bottomRef: Ref<HTMLDivElement>;
};

export default function PlannerChatPanel({
  glassPanel,
  premiumEase,
  chatMessages,
  typing,
  chatInput,
  setChatInput,
  sendChat,
  looksLikeItinerary,
  syncFieldsFromChat,
  onSwitchToPlannerMode,
  voiceSettingsOpen,
  setVoiceSettingsOpen,
  voiceSettingsContent,
  handleVoiceCommand,
  setListening,
  setVoiceStatus,
  voiceStatus,
  voiceSettings,
  bottomRef,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: premiumEase }}
      className={`w-full max-w-4xl mx-auto ${glassPanel} flex flex-col h-[70vh] md:h-[75vh] overflow-hidden`}
    >
      <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-teal-500/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-teal-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Rahi Assistant</h3>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-400">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rahi-btn-ghost"
            onClick={() => setVoiceSettingsOpen((prev) => !prev)}
          >
            <Settings className="w-4 h-4" />
            Voice
          </button>
          <RahiVoiceUI
            onText={(text) => {
              if (handleVoiceCommand(text)) {
                setVoiceStatus("idle");
                return;
              }
              setChatInput(text);
              window.setTimeout(() => {
                void sendChat(text, "voice");
              }, 200);
            }}
            onListening={(active) => {
              setListening(active);
              setVoiceStatus((prev) => {
                if (active) return "listening";
                return prev === "listening" ? "idle" : prev;
              });
            }}
            status={voiceStatus}
            lang={voiceSettings.lang}
            autoSend={voiceSettings.autoSend}
            earcons={voiceSettings.earcons}
          />
        </div>
      </div>

      {voiceSettingsOpen && <div className="px-4 pb-4">{voiceSettingsContent}</div>}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
            <div className="p-6 rounded-full bg-white/5 border border-white/10">
              <MessageSquare className="h-12 w-12 text-teal-500/50" />
            </div>
            <div className="text-center">
              <p className="text-lg text-white font-medium">👋 Hi! I'm Rahi.AI</p>
              <p className="text-sm">Ask me anything to start planning.</p>
            </div>
            <div className="flex gap-2 text-xs">
              <span
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition"
                onClick={() => {
                  void sendChat("Plan a trip to Goa");
                }}
              >
                🏖️ Plan Goa Trip
              </span>
              <span
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition"
                onClick={() => {
                  void sendChat("Budget tips for students");
                }}
              >
                💰 Budget Tips
              </span>
            </div>
          </div>
        )}

        {chatMessages.map((msg, i) => {
          const isAI = msg.startsWith("Rahi.AI:");
          const textContent = isAI ? msg.slice(8) : msg.slice(4);

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={i}
              className={`flex ${isAI ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[85%] p-4 rounded-2xl ${
                  isAI
                    ? "bg-white/10 text-gray-200 border border-white/5 rounded-tl-none"
                    : "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg rounded-tr-none"
                }`}
              >
                <span className="block text-[10px] opacity-70 mb-1 font-bold uppercase tracking-wider">
                  {isAI ? "Rahi.AI" : "You"}
                </span>
                <div className="prose prose-invert prose-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {textContent}
                  </ReactMarkdown>
                </div>

                {isAI && looksLikeItinerary(textContent) && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/10">
                    <button
                      onClick={() => {
                        syncFieldsFromChat(textContent);
                        onSwitchToPlannerMode();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/40 text-teal-300 text-xs rounded-lg transition border border-teal-500/30"
                    >
                      <Sparkles className="w-3 h-3" /> Convert to Planner
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {typing && (
          <div className="flex items-center gap-2 text-gray-500 text-sm italic ml-2">
            <div className="flex gap-1">
              <span
                className="w-2 h-2 rounded-full bg-teal-500 animate-bounce"
                style={{ animationDelay: "0s" }}
              />
              <span
                className="w-2 h-2 rounded-full bg-teal-500 animate-bounce"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="w-2 h-2 rounded-full bg-teal-500 animate-bounce"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
            Rahi is thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 sm:p-4 bg-black/40 border-t border-white/10 backdrop-blur-md">
        <div className="flex gap-2">
          <input
            className="flex-1 rahi-input"
            placeholder="Ask Rahi (e.g., '3 day trip to Manali under 10k')..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void sendChat();
              }
            }}
          />
          <button
            onClick={() => {
              void sendChat();
            }}
            className="rahi-btn-primary px-3 py-3"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
