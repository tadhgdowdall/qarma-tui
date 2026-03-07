import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextAttributes, TextRenderable } from "@opentui/core";
import type { SessionSummary } from "../../shared/types";

function createSidebarItem(
  renderer: CliRenderer,
  session: SessionSummary,
): BoxRenderable {
  const item = new BoxRenderable(renderer, {
    flexDirection: "column",
    border: true,
    borderColor: session.active ? "#f97316" : "#111111",
    backgroundColor: session.active ? "#101010" : "#050505",
    padding: 1,
  });

  item.add(
    new TextRenderable(renderer, {
      content: session.label,
      fg: session.active ? "#fafafa" : "#d4d4d4",
      attributes: TextAttributes.BOLD,
    }),
  );

  item.add(
    new TextRenderable(renderer, {
      content: session.preview,
      fg: "#737373",
      wrapMode: "word",
    }),
  );

  return item;
}

export function createSidebar(
  renderer: CliRenderer,
  sessions: SessionSummary[],
): BoxRenderable {
  const sidebar = new BoxRenderable(renderer, {
    width: 24,
    flexDirection: "column",
    border: true,
    borderColor: "#1f1f1f",
    backgroundColor: "#050505",
    padding: 1,
    gap: 1,
    title: "Qarma",
  });

  sidebar.add(
    new TextRenderable(renderer, {
      content: "SESSIONS",
      fg: "#f97316",
      attributes: TextAttributes.DIM,
    }),
  );

  for (const session of sessions) {
    sidebar.add(createSidebarItem(renderer, session));
  }

  sidebar.add(
    new TextRenderable(renderer, {
      content: "Recent sessions.",
      fg: "#737373",
      attributes: TextAttributes.DIM,
      wrapMode: "word",
    }),
  );

  return sidebar;
}
