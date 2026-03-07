import type { Test } from "../models/test";
import type { TestRun } from "../models/test-run";

export interface QarmaApi {
  listTests(workspaceId: string): Promise<Test[]>;
  runSavedTest(testId: string): Promise<{ runId: string }>;
  subscribeToRun(runId: string, onUpdate: (run: TestRun) => void): () => void;
}
