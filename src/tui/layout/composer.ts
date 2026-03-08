import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, InputRenderable, InputRenderableEvents, TextAttributes, TextRenderable } from "@opentui/core";
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
    marginBottom: 1,
  });

  const input = new InputRenderable(renderer, {
    value: "",
    placeholder: "Verify sign in reaches the dashboard...",
    maxLength: 4000,
    width: "100%",
    minWidth: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    paddingX: 0,
    backgroundColor: "#141414",
    textColor: "#fafafa",
    placeholderColor: "#6b6b6b",
  });

  const suggestions = new BoxRenderable(renderer, {
    flexDirection: "column",
    backgroundColor: "#141414",
    paddingTop: 0,
    paddingRight: 1,
    paddingBottom: 0,
    paddingLeft: 1,
    gap: 0,
    visible: false,
  });

  input.on("enter", onSubmit);
  inputShell.add(input);
  composer.add(inputShell);
  composer.add(suggestions);

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

  input.on(InputRenderableEvents.INPUT, () => {
    composer.requestRender();
  });

  return { composer, input, updateSuggestions, hideSuggestions };
}
