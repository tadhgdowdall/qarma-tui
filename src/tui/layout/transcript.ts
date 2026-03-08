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
    paddingTop: 0,
    paddingRight: 1,
    paddingBottom: 0,
    paddingLeft: 1,
    gap: 0,
    backgroundColor: "#0a0a0a",
  });

  const transcript = new ScrollBoxRenderable(renderer, {
    flexGrow: 1,
    border: false,
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
      gap: 1,
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
      message.variant === "prompt"
        ? "#0d0d0d"
        : message.variant === "step"
          ? "#0b0b0b"
          : "#0a0a0a",
    paddingTop: message.variant === "step" ? 0 : 0,
    paddingRight: message.variant === "prompt" ? 1 : 0,
    paddingBottom: 0,
    paddingLeft: message.variant === "prompt" ? 1 : 0,
    gap: message.variant === "step" ? 0 : 0,
    alignSelf: "stretch",
    maxWidth: "100%",
  });

  if (message.variant === "step") {
    const row = new BoxRenderable(renderer, {
      flexDirection: "row",
      gap: 1,
    });

    const rail = new BoxRenderable(renderer, {
      width: 1,
      minWidth: 1,
      maxWidth: 1,
      backgroundColor:
        message.stepStatus === "passed"
          ? "#4ade80"
          : message.stepStatus === "failed"
            ? "#f87171"
            : message.stepStatus === "running"
              ? "#f97316"
              : "#1f1f1f",
    });

    const marker = new BoxRenderable(renderer, {
      flexDirection: "column",
      flexGrow: 1,
    });

    marker.add(
      new TextRenderable(renderer, {
        content: message.content,
        fg: "#f5f5f5",
        wrapMode: "word",
        selectable: true,
        selectionBg: "#f97316",
        selectionFg: "#050505",
      }),
    );

    for (const detailLine of message.detailLines || []) {
      marker.add(
        new TextRenderable(renderer, {
          content: detailLine,
          fg: "#8a8a8a",
          wrapMode: "word",
          selectable: true,
          selectionBg: "#f97316",
          selectionFg: "#050505",
          attributes: TextAttributes.DIM,
        }),
      );
    }

    row.add(rail);
    row.add(marker);
    bubble.add(row);
  } else {
    bubble.add(
      new TextRenderable(renderer, {
        content: message.content,
        fg: message.variant === "system" ? "#8a8a8a" : "#f5f5f5",
        wrapMode: "word",
        selectable: true,
        selectionBg: "#f97316",
        selectionFg: "#050505",
        attributes: message.variant === "system" ? TextAttributes.DIM : TextAttributes.NONE,
      }),
    );
  }

  transcript.add(bubble);
  transcript.scrollTo({ y: transcript.scrollHeight, x: 0 });
}
