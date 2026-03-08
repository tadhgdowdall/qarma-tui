import type { RunRequest } from "../../core/models/run";

export type RunSettings = {
  workspaceId: string;
  targetUrl: string;
  executionMode: "local" | "cloud";
  providerProfileId: string;
  modelSource: "user_api_key" | "qarma_managed";
  modelProvider: "openai" | "browser_use_cloud";
  modelId?: string;
  browser: "chromium";
  headless: boolean;
  timeoutSeconds: number;
  syncResultsToQarma: boolean;
};

export const defaultRunSettings: RunSettings = {
  workspaceId: process.env.QARMA_WORKSPACE_ID || "demo-workspace",
  targetUrl: process.env.QARMA_TARGET_URL || "http://localhost:3000",
  executionMode: "local",
  providerProfileId: process.env.QARMA_PROVIDER_PROFILE || "openai-local",
  modelSource: process.env.QARMA_PROVIDER_PROFILE === "qarma-managed" ? "qarma_managed" : "user_api_key",
  modelProvider: process.env.QARMA_PROVIDER_PROFILE === "qarma-managed" ? "browser_use_cloud" : "openai",
  modelId: process.env.QARMA_MODEL_ID || "gpt-5-nano",
  browser: "chromium",
  headless: false,
  timeoutSeconds: 60,
  syncResultsToQarma: true,
};

export function buildRunRequest(prompt: string, settings: RunSettings = defaultRunSettings): RunRequest {
  return {
    workspaceId: settings.workspaceId,
    prompt,
    triggeredBy: "manual",
    runConfig: {
      executionMode: settings.executionMode,
      modelSource: settings.modelSource,
      modelProvider: settings.modelProvider,
      modelId: settings.modelId,
      providerProfileId: settings.providerProfileId,
      browser: settings.browser,
      headless: settings.headless,
      timeoutSeconds: settings.timeoutSeconds,
      targetUrlOverride: settings.targetUrl,
      syncResultsToQarma: settings.syncResultsToQarma,
    },
  };
}

export function formatRunSettings(settings: RunSettings): string {
  const provider = settings.providerProfileId === "qarma-managed" ? "qarma" : "openai";
  const model = settings.modelId || "provider-default";
  return `${settings.executionMode}  ${settings.targetUrl.replace(/^https?:\/\//, "")}  ${provider}  ${model}`;
}
