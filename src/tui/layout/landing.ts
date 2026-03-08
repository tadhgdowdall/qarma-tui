import type { CliRenderer } from "@opentui/core";
import {
  ASCIIFontRenderable,
  BoxRenderable,
  InputRenderable,
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

  const input = new InputRenderable(renderer, {
    value: "",
    placeholder: "Verify sign in reaches the dashboard...",
    maxLength: 4000,
    paddingX: 1,
    backgroundColor: "#050505",
    textColor: "#fafafa",
    placeholderColor: "#737373",
  });

  input.on("enter", onSubmit);
  panel.add(input);

  panel.add(
    new TextRenderable(renderer, {
      content: "paste supported  enter to start  q quit",
      fg: "#737373",
      attributes: TextAttributes.DIM,
    }),
  );

  content.add(panel);

  view.add(content);

  return { view, input };
}
