import type { CliRenderer } from "@opentui/core";
import { BoxRenderable, TextAttributes, TextRenderable } from "@opentui/core";
import type { RecentRunSummary } from "../../shared/types";

function createSidebarItem(
  renderer: CliRenderer,
  run: RecentRunSummary,
): BoxRenderable {
  const statusColor =
    run.status === "passed"
      ? "#4ade80"
      : run.status === "failed"
        ? "#f87171"
        : run.status === "cancelled"
          ? "#f59e0b"
          : "#f97316";

  const item = new BoxRenderable(renderer, {
    flexDirection: "row",
    backgroundColor: run.active ? "#101010" : "#050505",
    padding: 1,
    gap: 1,
  });

  item.add(
    new BoxRenderable(renderer, {
      flexDirection: "column",
      width: 1,
      minWidth: 1,
      maxWidth: 1,
      backgroundColor: statusColor,
    }),
  );

  const content = new BoxRenderable(renderer, {
    flexDirection: "column",
    flexGrow: 1,
    gap: 0,
  });

  content.add(
    new TextRenderable(renderer, {
      content: run.prompt,
      fg: run.active ? "#fafafa" : "#d4d4d4",
      attributes: TextAttributes.BOLD,
      wrapMode: "word",
    }),
  );

  content.add(
    new TextRenderable(renderer, {
      content: `${run.target}  ${run.status}`,
      fg: "#8a8a8a",
      attributes: TextAttributes.DIM,
      wrapMode: "word",
    }),
  );

  content.add(
    new TextRenderable(renderer, {
      content: run.subtitle,
      fg: "#737373",
      wrapMode: "word",
      attributes: TextAttributes.DIM,
    }),
  );

  item.add(content);

  return item;
}

export function createSidebar(
  renderer: CliRenderer,
  runs: RecentRunSummary[],
) {
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

  const heading = new TextRenderable(renderer, {
    content: "RECENT RUNS",
    fg: "#f97316",
    attributes: TextAttributes.DIM,
  });
  sidebar.add(heading);

  const list = new BoxRenderable(renderer, {
    flexDirection: "column",
    gap: 1,
  });
  sidebar.add(list);

  const empty = new TextRenderable(renderer, {
    content: "No runs yet.",
    fg: "#737373",
    attributes: TextAttributes.DIM,
    wrapMode: "word",
  });
  sidebar.add(empty);

  function update(nextRuns: RecentRunSummary[]) {
    for (const child of list.getChildren()) {
      list.remove(child.id);
    }

    empty.visible = nextRuns.length === 0;

    for (const run of nextRuns) {
      list.add(createSidebarItem(renderer, run));
    }

    sidebar.requestRender();
  }

  update(runs);

  return { sidebar, update };
}
