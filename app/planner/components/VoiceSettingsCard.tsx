"use client";

import type { Dispatch, SetStateAction } from "react";
import type { VoiceSettings } from "../types";

type Props = {
  voiceSettings: VoiceSettings;
  setVoiceSettings: Dispatch<SetStateAction<VoiceSettings>>;
};

export default function VoiceSettingsCard({
  voiceSettings,
  setVoiceSettings,
}: Props) {
  const toggleSetting = (key: keyof Omit<VoiceSettings, "lang">) => {
    setVoiceSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="rahi-card rahi-voice-settings-card border border-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="rahi-label rahi-label-premium">Voice Settings</span>
        <span className="text-[10px] text-gray-400 uppercase tracking-[0.18em]">
          Personal
        </span>
      </div>
      <div className="space-y-3">
        <div className="rahi-voice-setting-row flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Voice Replies</p>
            <p className="text-xs text-gray-400">Speak AI responses aloud.</p>
          </div>
          <button
            className={`rahi-toggle ${voiceSettings.tts ? "is-on" : ""}`}
            onClick={() => toggleSetting("tts")}
            type="button"
          >
            <span className="sr-only">Toggle voice replies</span>
          </button>
        </div>

        <div className="rahi-voice-setting-row flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Earcon Chimes</p>
            <p className="text-xs text-gray-400">Soft cues on start/send.</p>
          </div>
          <button
            className={`rahi-toggle ${voiceSettings.earcons ? "is-on" : ""}`}
            onClick={() => toggleSetting("earcons")}
            type="button"
          >
            <span className="sr-only">Toggle earcons</span>
          </button>
        </div>

        <div className="rahi-voice-setting-row flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Auto Send</p>
            <p className="text-xs text-gray-400">Send after short pause.</p>
          </div>
          <button
            className={`rahi-toggle ${voiceSettings.autoSend ? "is-on" : ""}`}
            onClick={() => toggleSetting("autoSend")}
            type="button"
          >
            <span className="sr-only">Toggle auto send</span>
          </button>
        </div>

        <div className="rahi-voice-setting-row flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Language</p>
            <p className="text-xs text-gray-400">Recognition preference.</p>
          </div>
          <select
            className="rahi-select"
            value={voiceSettings.lang}
            onChange={(e) =>
              setVoiceSettings((prev) => ({
                ...prev,
                lang: e.target.value === "hi-IN" ? "hi-IN" : "en-IN",
              }))
            }
          >
            <option value="en-IN">English (IN)</option>
            <option value="hi-IN">Hindi (IN)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
