import type { QarmaApi } from "../../core/ports/qarma-api";

export const qarmaApiClient: QarmaApi = {
  async listTests() {
    return [];
  },
  async runSavedTest() {
    return { runId: "stub-run" };
  },
  subscribeToRun() {
    return () => {};
  },
};
