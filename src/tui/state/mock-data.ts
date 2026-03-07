import type { Message, SessionSummary } from "../../shared/types";

export const sampleSessions: SessionSummary[] = [
  {
    label: "signup flow",
    preview: "local ready",
    active: true,
  },
  {
    label: "checkout smoke",
    preview: "passed 8m ago",
  },
  {
    label: "dashboard auth",
    preview: "cloud failed",
  },
];

export const sampleMessages: Message[] = [
  {
    speaker: "Qarma",
    accent: "#f97316",
    content:
      "Ready. I can run natural language browser tests locally or against a live URL.",
  },
  {
    speaker: "System",
    accent: "#a3a3a3",
    content: "Mode is local. Target is localhost:3000. Provider is OpenAI.",
  },
  {
    speaker: "Hint",
    accent: "#737373",
    content:
      "Keep prompts short and outcome-focused. Example: verify a user can sign in and reach the dashboard.",
  },
];
