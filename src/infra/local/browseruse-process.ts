import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type { ResolvedModelAccess } from "../../core/models/provider";
import type { RunFailureKind, TestRunStep } from "../../core/models/run";
import { resolvePythonRuntime } from "../runtime/python-runtime";

type BrowserUseProcessInput = {
  prompt: string;
  targetUrl: string;
  timeoutSeconds: number;
  headless: boolean;
  modelId?: string;
  access: ResolvedModelAccess;
  onStep?: (step: TestRunStep) => void;
};

type BrowserUseProcessResult = {
  status: "passed" | "failed" | "cancelled";
  result: string;
  errorMessage?: string;
  failureKind?: RunFailureKind;
  steps: TestRunStep[];
};

type BrowserUseProcessHandle = {
  result: Promise<BrowserUseProcessResult>;
  cancel: () => void;
};

type StreamMessage =
  | {
      type: "step";
      step?: number;
      title?: string;
      description?: string;
      status?: string;
      url?: string;
      action?: string;
      observation?: string;
    }
  | {
      type: "result";
      status?: "passed" | "failed";
      result?: string;
      error?: string;
      error_kind?: RunFailureKind;
      steps?: Array<{
        number?: number;
        title?: string;
        description?: string;
        status?: string;
        url?: string;
        action?: string;
        observation?: string;
      }>;
    };

const agentRunnerPath = fileURLToPath(new URL("./python/agent_runner.py", import.meta.url));
const pythonModuleDir = dirname(agentRunnerPath);

function toRunStep(
  step: {
    number?: number;
    title?: string;
    description?: string;
    status?: string;
    url?: string;
    action?: string;
    observation?: string;
  },
  fallbackNumber: number,
): TestRunStep {
  const status =
    step.status === "passed" || step.status === "failed" || step.status === "running"
      ? step.status
      : "info";

  return {
    step: step.number || fallbackNumber,
    title: step.title || step.description || "Browser-Use step",
    status,
    url: step.url,
    action: step.action,
    observation: step.observation,
    timestamp: new Date().toISOString(),
  };
}

export function runBrowserUseLocally(
  input: BrowserUseProcessInput,
): BrowserUseProcessHandle {
  if (input.access.mode === "user_api_key" && input.access.provider !== "openai") {
    throw new Error(`Direct local provider "${input.access.provider}" is not wired yet.`);
  }

  if (input.access.mode === "local_model") {
    throw new Error("Local model execution is not enabled yet.");
  }

  if (input.access.mode === "qarma_managed" && !input.access.baseUrl) {
    throw new Error("Qarma managed execution requires QARMA_API_URL to be configured locally.");
  }

  const env: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV || "production",
    PATH: process.env.PATH || "",
    HOME: process.env.HOME || "",
    USER: process.env.USER || "",
    LANG: process.env.LANG || "en_US.UTF-8",
    PYTHONPATH: pythonModuleDir,
    QARMA_URL: input.targetUrl,
    QARMA_TASK: input.prompt,
    QARMA_TIMEOUT: String(input.timeoutSeconds),
    QARMA_HEADLESS: input.headless ? "true" : "false",
  };

  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH;
  }

  if (input.modelId) {
    env.QARMA_MODEL_ID = input.modelId;
  }

  if (input.access.mode === "user_api_key") {
    env.OPENAI_API_KEY = input.access.apiKey;
  } else if (input.access.mode === "qarma_managed") {
    env.QARMA_ACCESS_TOKEN = input.access.accessToken;
    if (input.access.baseUrl) {
      env.QARMA_API_URL = input.access.baseUrl;
    }
  }

  const pythonBin = resolvePythonRuntime().pythonBin;
  const proc = spawn(pythonBin, [agentRunnerPath], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });

  const steps: TestRunStep[] = [];
  let stdoutBuffer = "";
  let stderr = "";
  let finalResult: BrowserUseProcessResult | null = null;
  let cancelled = false;
  let forcedKillTimer: ReturnType<typeof setTimeout> | null = null;
  let lastStepFingerprint = "";

  function killProcessTree(signal: NodeJS.Signals) {
    if (!proc.pid) {
      return;
    }

    if (process.platform === "win32") {
      proc.kill(signal);
      return;
    }

    try {
      process.kill(-proc.pid, signal);
    } catch {
      proc.kill(signal);
    }
  }

  proc.stdout.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        const message = JSON.parse(line) as StreamMessage;

        if (message.type === "step") {
          const fingerprint = JSON.stringify([
            message.title || message.description || "",
            message.status || "",
            message.observation || "",
          ]);
          if (fingerprint === lastStepFingerprint) {
            continue;
          }
          lastStepFingerprint = fingerprint;

          const step = toRunStep(
            {
              number: message.step,
              title: message.title,
              description: message.description,
              status: message.status,
              url: message.url,
              action: message.action,
              observation: message.observation,
            },
            steps.length + 1,
          );
          steps.push(step);
          input.onStep?.(step);
        }

        if (message.type === "result") {
          const resultSteps = message.steps?.map((step, index) => toRunStep(step, index + 1)) || steps;
          finalResult = {
            status: message.status || "failed",
            result: message.result || "Browser-Use run completed.",
            errorMessage: message.error,
            failureKind: message.error_kind,
            steps: resultSteps,
          };
        }
      } catch {
        continue;
      }
    }
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  return {
    cancel() {
      cancelled = true;
      killProcessTree("SIGTERM");
      forcedKillTimer = setTimeout(() => {
        killProcessTree("SIGKILL");
      }, 2500);
    },
    result: new Promise((resolve, reject) => {
    proc.on("error", (error) => {
      reject(error);
    });

    proc.on("close", (code, signal) => {
      if (forcedKillTimer) {
        clearTimeout(forcedKillTimer);
        forcedKillTimer = null;
      }

      if (cancelled) {
        resolve({
          status: "cancelled",
          result: "Run cancelled.",
          errorMessage: undefined,
          failureKind: "cancelled",
          steps,
        });
        return;
      }

      if (signal === "SIGTERM" || signal === "SIGKILL") {
        resolve({
          status: "cancelled",
          result: "Run cancelled.",
          errorMessage: undefined,
          failureKind: "cancelled",
          steps,
        });
        return;
      }

      if (finalResult) {
        resolve(finalResult);
        return;
      }

      resolve({
        status: "failed",
        result: "Browser-Use process did not return a final result.",
        errorMessage: stderr.trim() || `Process exited with code ${code ?? "unknown"}.`,
        failureKind: "runtime",
        steps,
      });
    });
    }),
  };
}
