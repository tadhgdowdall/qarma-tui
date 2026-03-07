export type Message = {
  speaker: string;
  content: string;
  accent: string;
};

export type SessionSummary = {
  label: string;
  preview: string;
  active?: boolean;
};
