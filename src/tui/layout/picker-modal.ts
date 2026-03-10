import type { CliRenderer } from "@opentui/core";
import {
  BoxRenderable,
  InputRenderable,
  TextAttributes,
  TextRenderable,
} from "@opentui/core";

export type PickerItem = {
  id: string;
  label: string;
  summary?: string;
};

export function createPickerModal(
  renderer: CliRenderer,
  title: string,
  placeholder: string,
) {
  const overlay = new BoxRenderable(renderer, {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    zIndex: 100,
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

  panel.add(
    new TextRenderable(renderer, {
      content: title,
      fg: "#f5f5f5",
      attributes: TextAttributes.BOLD,
    }),
  );

  const search = new InputRenderable(renderer, {
    value: "",
    placeholder,
    width: "100%",
    minWidth: "100%",
    maxWidth: "100%",
    backgroundColor: "#161616",
    textColor: "#f5f5f5",
    focusedBackgroundColor: "#161616",
    focusedTextColor: "#f5f5f5",
    placeholderColor: "#6b6b6b",
  });

  const list = new BoxRenderable(renderer, {
    flexDirection: "column",
    gap: 0,
  });

  const empty = new TextRenderable(renderer, {
    content: "No matches.",
    fg: "#737373",
    attributes: TextAttributes.DIM,
  });

  panel.add(search);
  panel.add(list);
  panel.add(empty);
  overlay.add(panel);

  function update(items: PickerItem[], selectedIndex: number) {
    for (const child of list.getChildren()) {
      list.remove(child.id);
    }

    empty.visible = items.length === 0;

    items.forEach((item, index) => {
      const row = new BoxRenderable(renderer, {
        flexDirection: "column",
        backgroundColor: index === selectedIndex ? "#1b1b1b" : "#111111",
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
      });

      row.add(
        new TextRenderable(renderer, {
          content: `${index === selectedIndex ? ">" : " "} ${item.label}`,
          fg: index === selectedIndex ? "#f97316" : "#f5f5f5",
          attributes: index === selectedIndex ? TextAttributes.BOLD : TextAttributes.NONE,
          truncate: true,
          wrapMode: "none",
        }),
      );

      if (item.summary) {
        row.add(
          new TextRenderable(renderer, {
            content: `  ${item.summary}`,
            fg: "#737373",
            attributes: TextAttributes.DIM,
            truncate: true,
            wrapMode: "none",
          }),
        );
      }

      list.add(row);
    });

    overlay.requestRender();
  }

  return { overlay, search, update };
}
