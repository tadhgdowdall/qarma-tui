import type { TestRun, TestRunStep, RunRequest } from "../models/run";
import type { QarmaApi } from "../ports/qarma-api";
import type { LocalRunner } from "../ports/local-runner";

type StartRunDependencies = {
  localRunner: LocalRunner;
  qarmaApi: QarmaApi;
};

type StartRunHandlers = {
  onStep?: (step: TestRunStep) => void;
  onStatus?: (run: TestRun) => void;
};

const TERMINAL_RUN_STATUSES = new Set(["passed", "failed", "cancelled"]);

export async function startRun(
  request: RunRequest,
  dependencies: StartRunDependencies,
  handlers: StartRunHandlers = {},
): Promise<TestRun> {
  if (request.runConfig.executionMode === "local") {
    const run = await dependencies.localRunner.startRun(request, handlers.onStep);
    handlers.onStatus?.(run);
    return run;
  }

  return new Promise<TestRun>(async (resolve, reject) => {
    let unsubscribe = () => {};

    try {
      const { runId } = await dependencies.qarmaApi.createRun(request);

      unsubscribe = dependencies.qarmaApi.subscribeToRun(runId, (run) => {
        handlers.onStatus?.(run);

        const nextStep = run.steps[run.steps.length - 1];
        if (nextStep) {
          handlers.onStep?.(nextStep);
        }

        if (TERMINAL_RUN_STATUSES.has(run.status)) {
          unsubscribe();
          resolve(run);
        }
      });
    } catch (error) {
      unsubscribe();
      reject(error);
    }
  });
}
