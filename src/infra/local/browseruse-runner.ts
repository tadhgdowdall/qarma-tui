import { resolveModelAccess } from "../../core/usecases/resolve-model-access";
import type { TestRun } from "../../core/models/run";
import type { LocalRunner } from "../../core/ports/local-runner";
import type { ProviderProfileStore } from "../../core/ports/provider-profile-store";
import type { SecretStore } from "../../core/ports/secret-store";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type BrowserUseRunnerDependencies = {
  providerProfiles: ProviderProfileStore;
  secrets: SecretStore;
};

export function createBrowserUseRunner(
  dependencies: BrowserUseRunnerDependencies,
): LocalRunner {
  return {
    async startRun(request, onStep) {
      const startedAt = new Date().toISOString();
      const run: TestRun = {
        id: "local-stub-run",
        workspaceId: request.workspaceId,
        testId: request.testId,
        promptSnapshot: request.prompt || "Saved test run",
        targetUrl: request.runConfig.targetUrlOverride || "http://localhost:3000",
        targetProfileId: request.runConfig.targetProfileId,
        environment: "local",
        status: "running",
        executionMode: "local",
        modelSource: request.runConfig.modelSource,
        modelProvider: request.runConfig.modelProvider,
        modelId: request.runConfig.modelId,
        browser: request.runConfig.browser,
        steps: [],
        screenshots: [],
        triggeredBy: request.triggeredBy,
        createdAt: startedAt,
        startedAt,
      };

      const { profile, access } = await resolveModelAccess(
        {
          profileId: request.runConfig.providerProfileId,
        },
        {
          providerProfiles: dependencies.providerProfiles,
          secrets: dependencies.secrets,
        },
      );

      const queuedStep = {
        step: 1,
        title: "Runner started",
        status: "info",
        observation: `Preparing local run for ${run.targetUrl}.`,
        timestamp: startedAt,
      } as const;
      run.steps.push(queuedStep);
      onStep?.(queuedStep);

      await sleep(120);

      const authStep = {
        step: 2,
        title: "Resolve model access",
        status: "passed",
        observation:
          access.mode === "user_api_key"
            ? `Using ${profile.label}. API key resolved locally and kept out of run state.`
            : access.mode === "qarma_managed"
              ? `Using ${profile.label}. Qarma token resolved locally for managed inference.`
              : `Using ${profile.label}. Local model endpoint is ${access.baseUrl}.`,
        timestamp: new Date().toISOString(),
      } as const;
      run.steps.push(authStep);
      onStep?.(authStep);

      await sleep(120);

      const navigateStep = {
        step: 3,
        title: "Navigate to target",
        status: "running",
        url: run.targetUrl,
        observation: "Launching the browser and loading the target URL.",
        timestamp: new Date().toISOString(),
      } as const;
      run.steps.push(navigateStep);
      onStep?.(navigateStep);

      await sleep(180);

      const assertionStep = {
        step: 4,
        title: "Evaluate prompt",
        status: "passed",
        observation:
          "Local execution path is now resolving provider access securely. Real Browser-Use process wiring is the next step.",
        timestamp: new Date().toISOString(),
      } as const;
      run.steps.push(assertionStep);
      onStep?.(assertionStep);

      run.status = "passed";
      run.result = "Local stub completed.";
      run.completedAt = new Date().toISOString();
      run.durationMs = new Date(run.completedAt).getTime() - new Date(startedAt).getTime();

      return run;
    },
  };
}
