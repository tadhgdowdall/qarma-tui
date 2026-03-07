import type { CliRenderer } from "@opentui/core";
import { mountHomeRoute } from "./routes/home";

export function mountApp(renderer: CliRenderer) {
  mountHomeRoute(renderer);
}
