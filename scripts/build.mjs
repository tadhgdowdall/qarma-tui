import { mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";

function resolveBunBin() {
  const candidates = [
    process.env.BUN_BUILD_BIN,
    process.env.BUN_BIN,
    join(homedir(), ".bun", "bin", "bun"),
    "bun",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === "bun" || existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Bun was not found. Install Bun or set BUN_BIN before running the build.");
}

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

const build = spawnSync(
  resolveBunBin(),
  ["build", "src/index.ts", "--target=node", "--outdir", "dist"],
  {
    stdio: "inherit",
  },
);

if (build.status !== 0) {
  process.exit(build.status || 1);
}

mkdirSync("dist/infra/local", { recursive: true });
cpSync("src/infra/local/python", "dist/infra/local/python", { recursive: true });
