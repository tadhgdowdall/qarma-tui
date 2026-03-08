export type BrowserName = "chromium" | "firefox" | "webkit";

export type TargetEnvironment =
  | "local"
  | "staging"
  | "production"
  | "preview"
  | "custom";

export type ExecutionMode = "local" | "cloud";

export type ModelSource = "qarma_managed" | "user_api_key" | "local_model";

export type ModelProvider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "ollama"
  | "browser_use_cloud";

export type TargetProfile = {
  id: string;
  workspaceId: string;
  name: string;
  environment: TargetEnvironment;
  baseUrl: string;
  description?: string;
  requiresTunnel?: boolean;
  defaultForNewRuns?: boolean;
};

export type TestDefinition = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  prompt: string;
  defaultTargetProfileId?: string;
  tags?: string[];
  status: "active" | "paused" | "archived";
  timeoutSeconds?: number;
  browser?: BrowserName;
  createdAt: string;
  updatedAt: string;
};

export type RunConfig = {
  executionMode: ExecutionMode;
  modelSource: ModelSource;
  modelProvider: ModelProvider;
  modelId?: string;
  providerProfileId?: string;
  browser: BrowserName;
  headless?: boolean;
  timeoutSeconds: number;
  targetProfileId?: string;
  targetUrlOverride?: string;
  syncResultsToQarma: boolean;
};

export type RunRequest = {
  workspaceId: string;
  testId?: string;
  prompt?: string;
  triggeredBy: "manual" | "scheduled" | "api";
  runConfig: RunConfig;
};

export type RunStatus = "queued" | "running" | "passed" | "failed" | "cancelled";

export type TestRunStepStatus = "queued" | "running" | "passed" | "failed" | "info";

export type TestRunStep = {
  step: number;
  title: string;
  status: TestRunStepStatus;
  url?: string;
  action?: string;
  observation?: string;
  timestamp?: string;
  raw?: Record<string, unknown>;
};

export type TestRun = {
  id: string;
  workspaceId: string;
  testId?: string;
  promptSnapshot: string;
  targetUrl: string;
  targetProfileId?: string;
  environment?: TargetEnvironment;
  status: RunStatus;
  result?: string;
  errorMessage?: string;
  executionMode: ExecutionMode;
  modelSource: ModelSource;
  modelProvider: ModelProvider;
  modelId?: string;
  browser: BrowserName;
  liveUrl?: string;
  steps: TestRunStep[];
  screenshots: string[];
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  triggeredBy: "manual" | "scheduled" | "api";
  createdAt: string;
};
