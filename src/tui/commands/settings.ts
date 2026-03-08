import type { RunSettings } from "../state/run-settings";

export type SettingsCommandResult =
  | { kind: "noop" }
  | { kind: "message"; content: string; accent?: string };

function normalizeProvider(profileId: string) {
  if (profileId === "qarma" || profileId === "qarma-managed") {
    return {
      providerProfileId: "qarma-managed",
      modelSource: "qarma_managed" as const,
      modelProvider: "browser_use_cloud" as const,
    };
  }

  return {
    providerProfileId: "openai-local",
    modelSource: "user_api_key" as const,
    modelProvider: "openai" as const,
  };
}

export function applySettingsCommand(value: string, settings: RunSettings): SettingsCommandResult {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return { kind: "noop" };
  }

  const [command, ...rest] = trimmed.slice(1).split(/\s+/);
  const argument = rest.join(" ").trim();

  if (command === "settings") {
    return {
      kind: "message",
      content: `Mode ${settings.executionMode}. Target ${settings.targetUrl}. Provider ${settings.providerProfileId}. Model ${settings.modelId || "provider-default"}. Headless ${settings.headless ? "on" : "off"}.`,
    };
  }

  if (command === "target") {
    if (!argument) {
      return { kind: "message", content: "Usage: /target http://localhost:3000", accent: "#f87171" };
    }
    settings.targetUrl = argument;
    return { kind: "message", content: `Target updated to ${settings.targetUrl}.`, accent: "#4ade80" };
  }

  if (command === "model") {
    if (!argument) {
      return { kind: "message", content: "Usage: /model gpt-5-nano", accent: "#f87171" };
    }
    settings.modelId = argument;
    return { kind: "message", content: `Model updated to ${settings.modelId}.`, accent: "#4ade80" };
  }

  if (command === "provider") {
    if (!argument) {
      return { kind: "message", content: "Usage: /provider openai-local", accent: "#f87171" };
    }
    const next = normalizeProvider(argument);
    settings.providerProfileId = next.providerProfileId;
    settings.modelSource = next.modelSource;
    settings.modelProvider = next.modelProvider;
    return { kind: "message", content: `Provider updated to ${settings.providerProfileId}.`, accent: "#4ade80" };
  }

  if (command === "headless") {
    if (argument !== "on" && argument !== "off") {
      return { kind: "message", content: "Usage: /headless on|off", accent: "#f87171" };
    }
    settings.headless = argument === "on";
    return {
      kind: "message",
      content: `Headless ${settings.headless ? "enabled" : "disabled"}.`,
      accent: "#4ade80",
    };
  }

  return { kind: "message", content: `Unknown command: /${command}`, accent: "#f87171" };
}
