import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, InputRenderable, TextAttributes, TextRenderable } from "@opentui/core";

export function createComposer(
  renderer: CliRenderer,
  onSubmit: (value: string) => void,
) {
  const composer = new BoxRenderable(renderer, {
    flexDirection: "column",
    flexShrink: 0,
    border: true,
    borderColor: "#f97316",
    backgroundColor: "#0f0f0f",
    padding: 1,
    gap: 1,
    minHeight: 5,
    maxHeight: 5,
    overflow: "hidden",
    title: "Prompt",
  });

  composer.add(
    new TextRenderable(renderer, {
      content: "Describe the flow to verify, or use /settings, /target, /openai-key.",
      fg: "#a3a3a3",
      attributes: TextAttributes.DIM,
      wrapMode: "none",
      truncate: true,
      width: "100%",
      minWidth: "100%",
      maxWidth: "100%",
    }),
  );

  const input = new InputRenderable(renderer, {
    value: "",
    placeholder: "Verify sign in reaches the dashboard...",
    maxLength: 4000,
    width: "100%",
    minWidth: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    paddingX: 1,
    backgroundColor: "#0a0a0a",
    textColor: "#fafafa",
    placeholderColor: "#737373",
  });

  input.on("enter", onSubmit);
  composer.add(input);

  return { composer, input };
}
