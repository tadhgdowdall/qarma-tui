import type { QarmaApi } from "../../core/ports/qarma-api";
import type { TestRun } from "../../core/models/run";

export const qarmaApiClient: QarmaApi = {
  async listTests() {
    return [];
  },
  async listTargetProfiles() {
    return [];
  },
  async createRun() {
    return { runId: `cloud-stub-${Date.now()}` };
  },
  subscribeToRun(runId, onUpdate) {
    const createdAt = new Date().toISOString();
    const steps: TestRun["steps"] = [];
    const targetUrl = "https://staging.example.com";

    const emit = (run: TestRun) => {
      onUpdate(run);
    };

    emit({
      id: runId,
      workspaceId: "demo-workspace",
      promptSnapshot: "Saved cloud test",
      targetUrl,
      environment: "staging",
      status: "queued",
      executionMode: "cloud",
      modelSource: "qarma_managed",
      modelProvider: "browser_use_cloud",
      browser: "chromium",
      steps,
      screenshots: [],
      triggeredBy: "manual",
      createdAt,
    });

    const timers = [
      setTimeout(() => {
        steps.push({
          step: 1,
          title: "Cloud run started",
          status: "running",
          observation: "Stub cloud execution has claimed the run.",
          timestamp: new Date().toISOString(),
        });

        emit({
          id: runId,
          workspaceId: "demo-workspace",
          promptSnapshot: "Saved cloud test",
          targetUrl,
          environment: "staging",
          status: "running",
          executionMode: "cloud",
          modelSource: "qarma_managed",
          modelProvider: "browser_use_cloud",
          browser: "chromium",
          steps: [...steps],
          screenshots: [],
          triggeredBy: "manual",
          createdAt,
          startedAt: createdAt,
        });
      }, 150),
      setTimeout(() => {
        steps.push({
          step: 2,
          title: "Assertion passed",
          status: "passed",
          observation: "Stub cloud execution completed successfully.",
          timestamp: new Date().toISOString(),
        });

        emit({
          id: runId,
          workspaceId: "demo-workspace",
          promptSnapshot: "Saved cloud test",
          targetUrl,
          environment: "staging",
          status: "passed",
          result: "Cloud stub completed.",
          executionMode: "cloud",
          modelSource: "qarma_managed",
          modelProvider: "browser_use_cloud",
          browser: "chromium",
          steps: [...steps],
          screenshots: [],
          triggeredBy: "manual",
          createdAt,
          startedAt: createdAt,
          completedAt: new Date().toISOString(),
        });
      }, 500),
    ];

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  },
};
