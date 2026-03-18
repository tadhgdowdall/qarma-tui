import type { CliRenderer } from "@opentui/core";
import {
  BoxRenderable,
  TextAttributes,
  TextRenderable,
} from "@opentui/core";

export function createSecretModal(
  renderer: CliRenderer,
  title: string,
  hint: string,
) {
  let value = "";
  let cursorVisible = true;
  let cursorTimer: ReturnType<typeof setInterval> | null = null;

  const overlay = new BoxRenderable(renderer, {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    zIndex: 110,
    visible: false,
  });

  const panel = new BoxRenderable(renderer, {
    flexDirection: "column",
    width: 64,
    maxWidth: "90%",
    backgroundColor: "#111111",
    border: true,
    borderColor: "#1f1f1f",
    padding: 1,
    gap: 1,
  });

  const heading = new TextRenderable(renderer, {
    content: title,
    fg: "#f5f5f5",
    attributes: TextAttributes.BOLD,
  });

  const maskedValue = new TextRenderable(renderer, {
    content: "",
    fg: "#f5f5f5",
    truncate: true,
    wrapMode: "none",
  });

  const helper = new TextRenderable(renderer, {
    content: hint,
    fg: "#737373",
    attributes: TextAttributes.DIM,
    wrapMode: "word",
  });

  panel.add(heading);
  panel.add(maskedValue);
  panel.add(helper);
  overlay.add(panel);

  function renderValue() {
    const bullets = value ? "•".repeat(value.length) : "";
    const cursor = cursorVisible ? "_" : " ";
    const placeholder = value ? "" : "Enter secret";

    maskedValue.content = `${bullets || placeholder}${cursor}`;
    maskedValue.fg = value ? "#f5f5f5" : "#6b6b6b";
    maskedValue.attributes = value
      ? TextAttributes.NONE
      : TextAttributes.DIM;
    overlay.requestRender();
  }

  function startCursor() {
    stopCursor();
    cursorVisible = true;
    renderValue();
    cursorTimer = setInterval(() => {
      cursorVisible = !cursorVisible;
      renderValue();
    }, 530);
  }

  function stopCursor() {
    if (cursorTimer) {
      clearInterval(cursorTimer);
      cursorTimer = null;
    }
  }

  return {
    overlay,
    update(nextValue: string) {
      value = nextValue;
      renderValue();
    },
    startCursor,
    stopCursor,
  };
}
