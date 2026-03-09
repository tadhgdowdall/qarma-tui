import type { CliRenderer } from "@opentui/core";
import {
  ASCIIFontRenderable,
  BoxRenderable,
  TextareaRenderable,
  TextAttributes,
  TextRenderable,
} from "@opentui/core";

export function createLandingView(
  renderer: CliRenderer,
  onSubmit: (value: string) => void,
) {
  const view = new BoxRenderable(renderer, {
    flexDirection: "column",
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    paddingLeft: 2,
    paddingRight: 2,
  });

  const content = new BoxRenderable(renderer, {
    flexDirection: "column",
    width: "70%",
    maxWidth: 84,
    alignItems: "center",
    gap: 2,
    backgroundColor: "#0a0a0a",
  });

  content.add(
    new ASCIIFontRenderable(renderer, {
      text: "QARMA",
      font: "block",
      color: "#f97316",
      backgroundColor: "#0a0a0a",
      alignSelf: "center",
    }),
  );

  const panel = new BoxRenderable(renderer, {
    flexDirection: "column",
    width: "100%",
    maxWidth: 68,
    border: true,
    borderColor: "#1f1f1f",
    backgroundColor: "#050505",
    paddingTop: 1,
    paddingRight: 2,
    paddingBottom: 1,
    paddingLeft: 2,
    gap: 1,
  });

  panel.add(
    new TextRenderable(renderer, {
      content: "Run natural language browser tests locally or against a live URL.",
      fg: "#a3a3a3",
      wrapMode: "word",
    }),
  );

  const input = new TextareaRenderable(renderer, {
    initialValue: "",
    placeholder: "Verify sign in reaches the dashboard...",
    width: "100%",
    minWidth: "100%",
    maxWidth: "100%",
    minHeight: 1,
    maxHeight: 4,
    overflow: "hidden",
    backgroundColor: "#050505",
    textColor: "#fafafa",
    focusedBackgroundColor: "#050505",
    focusedTextColor: "#fafafa",
    placeholderColor: "#737373",
    wrapMode: "word",
    keyBindings: [
      { name: "return", action: "submit" },
      { name: "linefeed", action: "newline" },
      { name: "return", shift: true, action: "newline" },
      { name: "linefeed", shift: true, action: "newline" },
      { name: "return", meta: true, action: "newline" },
      { name: "linefeed", meta: true, action: "newline" },
      { name: "j", ctrl: true, action: "newline" },
    ],
    onSubmit: () => onSubmit(input.plainText),
  });
  panel.add(input);

  panel.add(
    new TextRenderable(renderer, {
      content: "enter to start",
      fg: "#737373",
      attributes: TextAttributes.DIM,
    }),
  );

  content.add(panel);

  view.add(content);

  return { view, input };
}
