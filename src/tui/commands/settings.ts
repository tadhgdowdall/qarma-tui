import type { RunSettings } from "../state/run-settings";
import { resolveTargetPreset } from "../state/run-settings";
import type { MutableSecretStore } from "../../infra/storage/session-secret-store";
import { macosKeychainStore } from "../../infra/storage/macos-keychain-store";

export type SettingsCommandResult =
  | { kind: "noop" }
  | { kind: "message"; content: string; accent?: string };

export type CommandSuggestion = {
  command: string;
  insertValue: string;
  summary: string;
  keywords?: string[];
  requiresArgument?: boolean;
};

const OPENAI_SECRET_REF = "openai_api_key";

const COMMAND_SUGGESTIONS: CommandSuggestion[] = [
  { command: "target", insertValue: "/target ", summary: "switch target URL or preset", keywords: ["url", "local", "staging", "prod"], requiresArgument: true },
  { command: "settings", insertValue: "/settings", summary: "show effective runtime settings", keywords: ["config", "status"] },
  { command: "help", insertValue: "/help", summary: "show commands and shortcuts", keywords: ["commands", "shortcuts"] },
  { command: "openai-key", insertValue: "/openai-key ", summary: "load an OpenAI key for this session", keywords: ["key", "secret", "session"], requiresArgument: true },
  { command: "save-openai-key", insertValue: "/save-openai-key ", summary: "save an OpenAI key to secure local storage", keywords: ["keychain", "secure", "persist"], requiresArgument: true },
  { command: "clear-openai-key", insertValue: "/clear-openai-key", summary: "remove the session key override", keywords: ["reset", "key"] },
  { command: "clear-saved-openai-key", insertValue: "/clear-saved-openai-key", summary: "remove the saved secure OpenAI key", keywords: ["keychain", "reset", "key"] },
  { command: "model", insertValue: "/model ", summary: "switch the model id", keywords: ["gpt", "openai"], requiresArgument: true },
  { command: "provider", insertValue: "/provider ", summary: "switch the provider profile", keywords: ["openai-local", "qarma-managed"], requiresArgument: true },
  { command: "headless", insertValue: "/headless ", summary: "toggle browser visibility", keywords: ["browser", "visible", "ui"], requiresArgument: true },
  { command: "cancel", insertValue: "/cancel", summary: "cancel the current local run", keywords: ["stop", "abort"] },
  { command: "rerun", insertValue: "/rerun", summary: "rerun the last submitted prompt", keywords: ["repeat", "again"] },
  { command: "clear", insertValue: "/clear", summary: "clear the transcript", keywords: ["wipe", "reset"] },
  { command: "commands", insertValue: "/commands", summary: "alias for /help", keywords: ["help"] },
];

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

function scoreSuggestion(query: string, suggestion: CommandSuggestion) {
  const normalizedQuery = query.toLowerCase();
  const command = suggestion.command.toLowerCase();
  const keywords = suggestion.keywords || [];

  if (!normalizedQuery) {
    if (command === "target") return 120;
    if (command === "settings") return 110;
    if (command === "help") return 100;
    return 80;
  }

  if (command === normalizedQuery) return 1000;
  if (command.startsWith(normalizedQuery)) return 900 - command.length;
  if (keywords.some((keyword) => keyword.toLowerCase() === normalizedQuery)) return 820;
  if (keywords.some((keyword) => keyword.toLowerCase().startsWith(normalizedQuery))) return 760;
  if (command.includes(normalizedQuery)) return 700 - command.indexOf(normalizedQuery);
  if (keywords.some((keyword) => keyword.toLowerCase().includes(normalizedQuery))) return 640;

  let fuzzyIndex = 0;
  let matched = 0;
  for (const char of normalizedQuery) {
    fuzzyIndex = command.indexOf(char, fuzzyIndex);
    if (fuzzyIndex === -1) {
      return -1;
    }
    matched += 1;
    fuzzyIndex += 1;
  }

  return 500 + matched;
}

export function getCommandSuggestions(value: string) {
  const trimmed = value.trimStart();
  if (!trimmed.startsWith("/")) {
    return [];
  }

  const [rawCommand] = trimmed.slice(1).split(/\s+/, 1);
  const query = rawCommand || "";

  return COMMAND_SUGGESTIONS
    .map((suggestion) => ({ suggestion, score: scoreSuggestion(query, suggestion) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.suggestion.command.length - right.suggestion.command.length)
    .slice(0, 6)
    .map((entry) => entry.suggestion);
}

export function shouldAcceptSuggestion(value: string, suggestion: CommandSuggestion | undefined) {
  if (!suggestion) {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return false;
  }

  const [rawCommand, ...rest] = trimmed.slice(1).split(/\s+/);
  const normalizedCommand = rawCommand || "";
  const hasArgument = rest.join(" ").trim().length > 0;

  if (normalizedCommand.length === 0) {
    return true;
  }

  if (normalizedCommand !== suggestion.command) {
    return suggestion.command.startsWith(normalizedCommand);
  }

  return suggestion.requiresArgument !== true && !hasArgument;
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
      content: `Mode ${settings.executionMode}. Target ${settings.targetUrl}${settings.targetPreset ? ` (${settings.targetPreset})` : ""}. Provider ${settings.providerProfileId}. Model ${settings.modelId || "provider-default"}. Headless ${settings.headless ? "on" : "off"}. OpenAI key source ${keySource}.`,
    };
  }

  if (command === "help" || command === "commands") {
    return {
      kind: "message",
      content: [
        "Commands",
        "  /settings",
        "  /target <url|local|staging|prod>",
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
        "  up/down browse slash commands",
        "  ctrl+y copy selected text",
        "  tab toggle sidebar",
        "  q quit",
        "  ctrl+g dev-skip on landing",
      ].join("\n"),
    };
  }

  if (command === "target") {
    if (!argument) {
      return { kind: "message", content: "Usage: /target http://localhost:3000 or /target local", accent: "#f87171" };
    }

    const preset = resolveTargetPreset(argument);
    if (preset) {
      settings.targetUrl = preset.url;
      settings.targetPreset = preset.name;
      return { kind: "message", content: `Target preset updated to ${preset.name} (${settings.targetUrl}).`, accent: "#4ade80" };
    }

    if (["staging", "stage", "prod", "production"].includes(argument.toLowerCase())) {
      return {
        kind: "message",
        content: `Target preset ${argument.toLowerCase()} is not configured. Set QARMA_TARGET_${argument.toLowerCase().startsWith("prod") ? "PRODUCTION" : "STAGING"} first.`,
        accent: "#f87171",
      };
    }

    if (!isValidHttpUrl(argument)) {
      return { kind: "message", content: "Target must start with http:// or https://", accent: "#f87171" };
    }
    settings.targetUrl = argument;
    settings.targetPreset = undefined;
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
