import type { RunRequest, TestRun, TestRunStep } from "../models/run";

export interface LocalRunner {
  startRun(
    request: RunRequest,
    onStep?: (step: TestRunStep) => void,
  ): Promise<TestRun>;
  cancelCurrentRun(): Promise<boolean>;
}
