export type Message = {
  speaker: string;
  content: string;
  accent: string;
  variant?: "default" | "prompt" | "step" | "system";
};

export type SessionSummary = {
  label: string;
  preview: string;
  active?: boolean;
};
