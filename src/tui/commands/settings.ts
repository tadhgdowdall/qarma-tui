import type { RunSettings } from "../state/run-settings";
import { resolveTargetPreset } from "../state/run-settings";
import type { MutableSecretStore } from "../../infra/storage/session-secret-store";
import { macosKeychainStore } from "../../infra/storage/macos-keychain-store";

export type SettingsCommandResult =
  | { kind: "noop" }
  | { kind: "open-model-picker" }
  | { kind: "open-target-picker" }
  | { kind: "open-screenshot-modal" }
  | { kind: "open-session-key-prompt" }
  | { kind: "open-persisted-key-prompt" }
  | { kind: "message"; content: string; accent?: string };

export type CommandSuggestion = {
  command: string;
  insertValue: string;
  summary: string;
  keywords?: string[];
  requiresArgument?: boolean;
};

export type ModelOption = {
  id: string;
  label: string;
  summary: string;
};

export type TargetOption = {
  id: string;
  label: string;
  summary: string;
  url: string;
  preset?: "local" | "staging" | "production";
};

const OPENAI_SECRET_REF = "openai_api_key";

const COMMAND_SUGGESTIONS: CommandSuggestion[] = [
  { command: "target", insertValue: "/target", summary: "open the target picker or set a URL", keywords: ["url", "local", "staging", "prod", "domain"], requiresArgument: false },
  { command: "settings", insertValue: "/settings", summary: "show effective runtime settings", keywords: ["config", "status"] },
  { command: "model", insertValue: "/model", summary: "open the model picker or set a model", keywords: ["models", "picker", "openai", "gpt"], requiresArgument: false },
  { command: "help", insertValue: "/help", summary: "show commands and shortcuts", keywords: ["commands", "shortcuts"] },
  { command: "screenshot", insertValue: "/screenshot", summary: "open the latest run screenshot", keywords: ["evidence", "image", "result"] },
  { command: "openai-key", insertValue: "/openai-key", summary: "load an OpenAI key for this session", keywords: ["key", "secret", "session"], requiresArgument: false },
  { command: "save-openai-key", insertValue: "/save-openai-key", summary: "save an OpenAI key to secure local storage", keywords: ["keychain", "secure", "persist"], requiresArgument: false },
  { command: "clear-openai-key", insertValue: "/clear-openai-key", summary: "remove the session key override", keywords: ["reset", "key"] },
  { command: "clear-saved-openai-key", insertValue: "/clear-saved-openai-key", summary: "remove the saved secure OpenAI key", keywords: ["keychain", "reset", "key"] },
  { command: "provider", insertValue: "/provider ", summary: "switch the provider profile", keywords: ["openai-local", "qarma-managed"], requiresArgument: true },
  { command: "headless", insertValue: "/headless ", summary: "toggle browser visibility", keywords: ["browser", "visible", "ui"], requiresArgument: true },
  { command: "cancel", insertValue: "/cancel", summary: "cancel the current local run", keywords: ["stop", "abort"] },
  { command: "rerun", insertValue: "/rerun", summary: "rerun the last submitted prompt", keywords: ["repeat", "again"] },
  { command: "clear", insertValue: "/clear", summary: "clear the transcript", keywords: ["wipe", "reset"] },
  { command: "commands", insertValue: "/commands", summary: "alias for /help", keywords: ["help"] },
];

const MODEL_OPTIONS: ModelOption[] = [
  { id: "gpt-5-nano", label: "gpt-5-nano", summary: "cheapest, fastest default" },
  { id: "gpt-4.1-mini", label: "gpt-4.1-mini", summary: "balanced cost and reliability" },
  { id: "gpt-4o-mini", label: "gpt-4o-mini", summary: "small multimodal general model" },
  { id: "gpt-4.1", label: "gpt-4.1", summary: "stronger reasoning for harder flows" },
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

export function normalizeTargetInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (isValidHttpUrl(trimmed)) {
    return trimmed;
  }

  if (/^[a-z0-9.-]+(?::\d+)?(\/.*)?$/i.test(trimmed)) {
    const scheme = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/i.test(trimmed)
      ? "http://"
      : "https://";
    const candidate = `${scheme}${trimmed}`;
    if (isValidHttpUrl(candidate)) {
      return candidate;
    }
  }

  return null;
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

function scoreModel(query: string, model: ModelOption) {
  const normalizedQuery = query.toLowerCase().trim();
  const label = model.label.toLowerCase();
  const summary = model.summary.toLowerCase();

  if (!normalizedQuery) {
    if (label === "gpt-5-nano") return 120;
    if (label === "gpt-4.1-mini") return 110;
    return 80;
  }

  if (label === normalizedQuery) return 1000;
  if (label.startsWith(normalizedQuery)) return 900 - label.length;
  if (label.includes(normalizedQuery)) return 700 - label.indexOf(normalizedQuery);
  if (summary.includes(normalizedQuery)) return 640;
  return -1;
}

export function searchCommandSuggestions(query: string, limit = 8) {
  const normalized = query.trim();
  return COMMAND_SUGGESTIONS
    .map((suggestion) => ({ suggestion, score: scoreSuggestion(normalized, suggestion) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.suggestion.command.length - right.suggestion.command.length)
    .slice(0, limit)
    .map((entry) => entry.suggestion);
}

export function searchModelOptions(query: string, limit = 8) {
  const normalized = query.trim();
  return MODEL_OPTIONS
    .map((model) => ({ model, score: scoreModel(normalized, model) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.model.label.length - right.model.label.length)
    .slice(0, limit)
    .map((entry) => entry.model);
}

export function searchTargetOptions(query: string, currentTarget: string, limit = 8): TargetOption[] {
  const normalized = query.trim();
  const options: TargetOption[] = [];
  const seen = new Set<string>();

  const local = resolveTargetPreset("local");
  if (local) {
    options.push({
      id: "target-local",
      label: "local",
      summary: local.url.replace(/^https?:\/\//, ""),
      url: local.url,
      preset: "local",
    });
    seen.add(local.url);
  }

  const staging = resolveTargetPreset("staging");
  if (staging) {
    options.push({
      id: "target-staging",
      label: "staging",
      summary: staging.url.replace(/^https?:\/\//, ""),
      url: staging.url,
      preset: "staging",
    });
    seen.add(staging.url);
  }

  const production = resolveTargetPreset("production");
  if (production) {
    options.push({
      id: "target-production",
      label: "production",
      summary: production.url.replace(/^https?:\/\//, ""),
      url: production.url,
      preset: "production",
    });
    seen.add(production.url);
  }

  if (!seen.has(currentTarget)) {
    options.unshift({
      id: "target-current",
      label: "current",
      summary: currentTarget.replace(/^https?:\/\//, ""),
      url: currentTarget,
    });
    seen.add(currentTarget);
  }

  const customTarget = normalizeTargetInput(normalized);
  if (customTarget && !seen.has(customTarget)) {
    options.unshift({
      id: "target-custom",
      label: `use ${customTarget.replace(/^https?:\/\//, "")}`,
      summary: "custom target",
      url: customTarget,
    });
  }

  if (!normalized) {
    return options.slice(0, limit);
  }

  const scored = options
    .map((option) => {
      const label = option.label.toLowerCase();
      const summary = option.summary.toLowerCase();
      const target = option.url.toLowerCase();
      let score = -1;

      if (label === normalized.toLowerCase()) score = 1000;
      else if (label.startsWith(normalized.toLowerCase())) score = 900 - label.length;
      else if (target.includes(normalized.toLowerCase())) score = 820 - target.indexOf(normalized.toLowerCase());
      else if (summary.includes(normalized.toLowerCase())) score = 760 - summary.indexOf(normalized.toLowerCase());

      return { option, score };
    })
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.option.label.length - right.option.label.length)
    .slice(0, limit)
    .map((entry) => entry.option);

  return scored;
}

export function getCommandSuggestions(value: string) {
  const trimmed = value.trimStart();
  if (!trimmed.startsWith("/")) {
    return [];
  }

  const [rawCommand] = trimmed.slice(1).split(/\s+/, 1);
  const query = rawCommand || "";
  return searchCommandSuggestions(query, 6);
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

  return false;
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
        "  /target [url|local|staging|prod]",
        "  /screenshot",
        "  /openai-key",
        "  /clear-openai-key",
        "  /save-openai-key",
        "  /clear-saved-openai-key",
        "  /cancel",
        "  /rerun",
        "  /clear",
        "  /model [model-id]",
        "  /provider openai-local|qarma-managed",
        "  /headless on|off",
        "",
        "Shortcuts",
        "  up/down browse slash commands",
        "  ctrl+p open command palette",
        "  ctrl+o open latest screenshot",
        "  ctrl+y copy selected text",
        "  tab toggle sidebar",
        "  esc close modal",
        "  ctrl+c quit",
        "  ctrl+g dev-skip on landing",
      ].join("\n"),
    };
  }

  if (command === "models") {
    return { kind: "open-model-picker" };
  }

  if (command === "screenshot") {
    return { kind: "open-screenshot-modal" };
  }

  if (command === "target") {
    if (!argument) {
      return { kind: "open-target-picker" };
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

    const normalizedTarget = normalizeTargetInput(argument);
    if (!normalizedTarget) {
      return { kind: "message", content: "Target must be a valid URL or domain, for example qarma.ie or http://localhost:3000.", accent: "#f87171" };
    }
    settings.targetUrl = normalizedTarget;
    settings.targetPreset = undefined;
    return { kind: "message", content: `Target updated to ${settings.targetUrl}.`, accent: "#4ade80" };
  }

  if (command === "openai-key") {
    if (argument) {
      return {
        kind: "message",
        content: "For security, use /openai-key without an inline value.",
        accent: "#f87171",
      };
    }
    return {
      kind: "open-session-key-prompt",
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
    if (argument) {
      return {
        kind: "message",
        content: "For security, use /save-openai-key without an inline value.",
        accent: "#f87171",
      };
    }

    if (!macosKeychainStore.isAvailable()) {
      return { kind: "message", content: "Secure key storage is not available on this platform.", accent: "#f87171" };
    }

    return {
      kind: "open-persisted-key-prompt",
    };
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
      return { kind: "open-model-picker" };
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
