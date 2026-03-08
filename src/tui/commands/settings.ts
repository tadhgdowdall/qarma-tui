import type { RunSettings } from "../state/run-settings";
import type { MutableSecretStore } from "../../infra/storage/session-secret-store";
import { macosKeychainStore } from "../../infra/storage/macos-keychain-store";

export type SettingsCommandResult =
  | { kind: "noop" }
  | { kind: "message"; content: string; accent?: string };

const OPENAI_SECRET_REF = "openai_api_key";

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

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function applySettingsCommand(
  value: string,
  settings: RunSettings,
  secrets: MutableSecretStore,
): Promise<SettingsCommandResult> {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return { kind: "noop" };
  }

  const [command, ...rest] = trimmed.slice(1).split(/\s+/);
  const argument = rest.join(" ").trim();

  if (command === "settings") {
    const keySource = await secrets.source(OPENAI_SECRET_REF);
    return {
      kind: "message",
      content: `Mode ${settings.executionMode}. Target ${settings.targetUrl}. Provider ${settings.providerProfileId}. Model ${settings.modelId || "provider-default"}. Headless ${settings.headless ? "on" : "off"}. OpenAI key source ${keySource}.`,
    };
  }

  if (command === "help" || command === "commands") {
    return {
      kind: "message",
      content: [
        "Commands",
        "  /settings",
        "  /target <url>",
        "  /openai-key <key>",
        "  /clear-openai-key",
        "  /save-openai-key <key>",
        "  /clear-saved-openai-key",
        "  /cancel",
        "  /rerun",
        "  /clear",
        "  /model <model-id>",
        "  /provider openai-local|qarma-managed",
        "  /headless on|off",
        "",
        "Shortcuts",
        "  ctrl+y copy selected text",
        "  tab toggle sidebar",
        "  q quit",
        "  ctrl+g dev-skip on landing",
      ].join("\n"),
    };
  }

  if (command === "target") {
    if (!argument) {
      return { kind: "message", content: "Usage: /target http://localhost:3000", accent: "#f87171" };
    }
    if (!isValidHttpUrl(argument)) {
      return { kind: "message", content: "Target must start with http:// or https://", accent: "#f87171" };
    }
    settings.targetUrl = argument;
    return { kind: "message", content: `Target updated to ${settings.targetUrl}.`, accent: "#4ade80" };
  }

  if (command === "openai-key") {
    if (!argument) {
      return { kind: "message", content: "Usage: /openai-key sk-...", accent: "#f87171" };
    }
    secrets.set(OPENAI_SECRET_REF, argument);
    return {
      kind: "message",
      content: "OpenAI key loaded for this session only.",
      accent: "#4ade80",
    };
  }

  if (command === "clear-openai-key") {
    secrets.clear(OPENAI_SECRET_REF);
    return {
      kind: "message",
      content: "Cleared session OpenAI key override. Falling back to environment lookup.",
      accent: "#4ade80",
    };
  }

  if (command === "save-openai-key") {
    if (!argument) {
      return { kind: "message", content: "Usage: /save-openai-key sk-...", accent: "#f87171" };
    }

    if (!macosKeychainStore.isAvailable()) {
      return { kind: "message", content: "Secure key storage is not available on this platform.", accent: "#f87171" };
    }

    try {
      macosKeychainStore.set(OPENAI_SECRET_REF, argument);
      secrets.clear(OPENAI_SECRET_REF);
      return {
        kind: "message",
        content: "Saved OpenAI key to secure local storage.",
        accent: "#4ade80",
      };
    } catch (error) {
      return {
        kind: "message",
        content: error instanceof Error ? error.message : "Failed to save key to secure local storage.",
        accent: "#f87171",
      };
    }
  }

  if (command === "clear-saved-openai-key") {
    if (!macosKeychainStore.isAvailable()) {
      return { kind: "message", content: "Secure key storage is not available on this platform.", accent: "#f87171" };
    }

    try {
      macosKeychainStore.clear(OPENAI_SECRET_REF);
      secrets.clear(OPENAI_SECRET_REF);
      return {
        kind: "message",
        content: "Removed saved OpenAI key from secure local storage and cleared the session override.",
        accent: "#4ade80",
      };
    } catch (error) {
      return {
        kind: "message",
        content: error instanceof Error ? error.message : "Failed to remove key from secure local storage.",
        accent: "#f87171",
      };
    }
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
