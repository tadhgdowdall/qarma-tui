export type Message = {
  speaker: string;
  content: string;
  accent: string;
  variant?: "default" | "prompt" | "step" | "system";
  detailLines?: string[];
  stepStatus?: "queued" | "running" | "passed" | "failed" | "info";
};

export type SessionSummary = {
  label: string;
  preview: string;
  active?: boolean;
};

export type RecentRunSummary = {
  id: string;
  prompt: string;
  target: string;
  status: "running" | "passed" | "failed" | "cancelled";
  subtitle: string;
  active?: boolean;
};
