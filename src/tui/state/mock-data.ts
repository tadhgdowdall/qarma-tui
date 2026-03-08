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
    accent: "#737373",
    content: "Ready for a local browser run.",
    variant: "system",
  },
];
