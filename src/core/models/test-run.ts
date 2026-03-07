export type TestRunStatus = "queued" | "running" | "passed" | "failed";

export type TestRunStep = {
  step: number;
  description: string;
  status: string;
};

export type TestRun = {
  id: string;
  status: TestRunStatus;
  steps: TestRunStep[];
};
