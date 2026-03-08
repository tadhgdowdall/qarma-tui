import type { CliRenderer } from "@opentui/core";
import {
  BoxRenderable,
  ScrollBoxRenderable,
  TextAttributes,
  TextRenderable,
} from "@opentui/core";
import type { Message } from "../../shared/types";

export function createTranscriptPanel(renderer: CliRenderer) {
  const panel = new BoxRenderable(renderer, {
    flexDirection: "column",
    flexGrow: 1,
    paddingTop: 1,
    paddingRight: 1,
    paddingBottom: 0,
    paddingLeft: 1,
    gap: 1,
    backgroundColor: "#0a0a0a",
  });

  panel.add(
    new TextRenderable(renderer, {
      content: "Qarma",
      fg: "#f97316",
      attributes: TextAttributes.BOLD,
    }),
  );

  panel.add(
    new TextRenderable(renderer, {
      content: "Local and cloud testing from one terminal workspace.",
      fg: "#a3a3a3",
      wrapMode: "word",
    }),
  );

  const transcript = new ScrollBoxRenderable(renderer, {
    flexGrow: 1,
    border: true,
    borderColor: "#141414",
    paddingTop: 1,
    paddingRight: 1,
    paddingBottom: 1,
    paddingLeft: 1,
    stickyScroll: true,
    stickyStart: "bottom",
    scrollY: true,
    scrollX: false,
    viewportOptions: {
      backgroundColor: "#0a0a0a",
    },
    contentOptions: {
      flexDirection: "column",
      gap: 0,
      paddingRight: 1,
    },
  });

  panel.add(transcript);

  return { panel, transcript };
}

export function addTranscriptMessage(
  renderer: CliRenderer,
  transcript: ScrollBoxRenderable,
  message: Message,
) {
  const bubble = new BoxRenderable(renderer, {
    flexDirection: "column",
    backgroundColor:
      message.variant === "step"
        ? "#111111"
        : message.variant === "system"
          ? "#080808"
          : "#0a0a0a",
    border: message.variant === "step",
    borderColor: message.variant === "step" ? "#1f1f1f" : undefined,
    paddingTop: message.variant === "step" ? 1 : 0,
    paddingRight: message.variant === "step" ? 1 : 0,
    paddingBottom: 1,
    paddingLeft: message.variant === "step" ? 1 : 0,
    marginBottom: message.variant === "step" ? 1 : 0,
  });

  bubble.add(
    new TextRenderable(renderer, {
      content: message.speaker.toUpperCase(),
      fg: message.accent,
      attributes:
        message.variant === "step" ? TextAttributes.BOLD : TextAttributes.DIM,
      selectable: true,
      selectionBg: "#f97316",
      selectionFg: "#050505",
    }),
  );

  bubble.add(
    new TextRenderable(renderer, {
      content: message.content,
      fg: "#f5f5f5",
      wrapMode: "word",
      selectable: true,
      selectionBg: "#f97316",
      selectionFg: "#050505",
    }),
  );

  transcript.add(bubble);
  transcript.scrollTo({ y: transcript.scrollHeight, x: 0 });
}
