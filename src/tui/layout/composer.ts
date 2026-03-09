import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextareaRenderable, TextAttributes, TextRenderable } from "@opentui/core";
import type { CommandSuggestion } from "../commands/settings";

export function createComposer(
  renderer: CliRenderer,
  onSubmit: (value: string) => void,
) {
  const composer = new BoxRenderable(renderer, {
    flexDirection: "column",
    flexShrink: 0,
    backgroundColor: "#0a0a0a",
    paddingTop: 0,
    paddingRight: 1,
    paddingBottom: 0,
    paddingLeft: 1,
    gap: 0,
    overflow: "hidden",
  });

  const inputShell = new BoxRenderable(renderer, {
    flexDirection: "column",
    backgroundColor: "#141414",
    paddingTop: 1,
    paddingRight: 1,
    paddingBottom: 1,
    paddingLeft: 1,
    gap: 1,
  });

  const input = new TextareaRenderable(renderer, {
    initialValue: "",
    placeholder: "Verify sign in reaches the dashboard...",
    width: "100%",
    minWidth: "100%",
    maxWidth: "100%",
    minHeight: 1,
    maxHeight: 4,
    overflow: "hidden",
    backgroundColor: "#141414",
    textColor: "#fafafa",
    focusedBackgroundColor: "#141414",
    focusedTextColor: "#fafafa",
    placeholderColor: "#6b6b6b",
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

  const suggestions = new BoxRenderable(renderer, {
    flexDirection: "column",
    backgroundColor: "#141414",
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    gap: 0,
    visible: false,
  });

  inputShell.add(input);
  inputShell.add(suggestions);
  composer.add(inputShell);

  function updateSuggestions(items: CommandSuggestion[], selectedIndex: number) {
    for (const child of suggestions.getChildren()) {
      suggestions.remove(child.id);
    }

    if (items.length === 0) {
      suggestions.visible = false;
      composer.requestRender();
      return;
    }

    suggestions.visible = true;

    items.forEach((item, index) => {
      const row = new BoxRenderable(renderer, {
        flexDirection: "column",
        backgroundColor: index === selectedIndex ? "#1b1b1b" : "#141414",
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
      });

      row.add(
        new TextRenderable(renderer, {
          content: `${index === selectedIndex ? ">" : " "} ${item.insertValue}`,
          fg: index === selectedIndex ? "#f97316" : "#f5f5f5",
          attributes: index === selectedIndex ? TextAttributes.BOLD : TextAttributes.NONE,
          truncate: true,
          wrapMode: "none",
        }),
      );

      row.add(
        new TextRenderable(renderer, {
          content: `  ${item.summary}`,
          fg: "#737373",
          attributes: TextAttributes.DIM,
          truncate: true,
          wrapMode: "none",
        }),
      );

      suggestions.add(row);
    });

    composer.requestRender();
  }

  function hideSuggestions() {
    updateSuggestions([], 0);
  }

  input.on("input", () => {
    composer.requestRender();
  });

  return { composer, input, updateSuggestions, hideSuggestions };
}
