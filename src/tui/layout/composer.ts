import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, InputRenderable, TextAttributes, TextRenderable } from "@opentui/core";

export function createComposer(
  renderer: CliRenderer,
  onSubmit: (value: string) => void,
) {
  const composer = new BoxRenderable(renderer, {
    flexDirection: "column",
    border: true,
    borderColor: "#f97316",
    backgroundColor: "#0f0f0f",
    padding: 1,
    gap: 1,
    title: "Prompt",
  });

  composer.add(
    new TextRenderable(renderer, {
      content: "Describe the flow to verify.",
      fg: "#a3a3a3",
      attributes: TextAttributes.DIM,
    }),
  );

  const input = new InputRenderable(renderer, {
    value: "",
    placeholder: "Verify sign in reaches the dashboard...",
    paddingX: 1,
    backgroundColor: "#0a0a0a",
    textColor: "#fafafa",
    placeholderColor: "#737373",
  });

  input.on("enter", onSubmit);
  composer.add(input);

  return { composer, input };
}
