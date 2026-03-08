import type {
  RunRequest,
  TargetProfile,
  TestDefinition,
  TestRun,
} from "../models/run";

export interface QarmaApi {
  listTests(workspaceId: string): Promise<TestDefinition[]>;
  listTargetProfiles(workspaceId: string): Promise<TargetProfile[]>;
  createRun(request: RunRequest): Promise<{ runId: string }>;
  subscribeToRun(runId: string, onUpdate: (run: TestRun) => void): () => void;
}
