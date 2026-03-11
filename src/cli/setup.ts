import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { macosKeychainStore } from "../infra/storage/macos-keychain-store";
import {
  findBootstrapPython,
  getManagedPythonBin,
  getManagedRuntimePaths,
  runPythonCommand,
  validateLocalRunnerImports,
  writeManagedRuntimeMetadata,
} from "../infra/runtime/python-runtime";

function requirementsPathFrom(importMetaUrl: string) {
  return fileURLToPath(new URL("../infra/local/python/requirements.txt", importMetaUrl));
}

function pythonModuleDirFrom(importMetaUrl: string) {
  return fileURLToPath(new URL("../infra/local/python", importMetaUrl));
}

async function promptYesNo(rl: ReturnType<typeof createInterface>, question: string, defaultYes = true) {
  const suffix = defaultYes ? " [Y/n] " : " [y/N] ";
  const answer = (await rl.question(`${question}${suffix}`)).trim().toLowerCase();
  if (!answer) {
    return defaultYes;
  }

  return answer === "y" || answer === "yes";
}

async function promptSecret(label: string) {
  output.write(label);
  const wasRaw = input.isTTY ? input.isRaw : false;
  let value = "";

  if (input.isTTY) {
    input.setRawMode?.(true);
    input.resume();
  }

  return await new Promise<string>((resolve) => {
    const onData = (chunk: Buffer) => {
      const text = chunk.toString("utf8");

      if (text === "\r" || text === "\n") {
        input.off("data", onData);
        if (input.isTTY) {
          input.setRawMode?.(Boolean(wasRaw));
        }
        output.write("\n");
        resolve(value.trim());
        return;
      }

      if (text === "\u0003") {
        input.off("data", onData);
        if (input.isTTY) {
          input.setRawMode?.(Boolean(wasRaw));
        }
        output.write("\n");
        process.exit(1);
      }

      if (text === "\u007f") {
        value = value.slice(0, -1);
        return;
      }

      value += text;
    };

    input.on("data", onData);
  });
}

function runStep(step: string, command: string, args: string[]) {
  console.log(step);
  const result = runPythonCommand(command, args);
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || "Command failed.";
    throw new Error(detail);
  }
}

export async function runSetup(importMetaUrl: string) {
  console.log("Qarma TUI setup\n");

  const bootstrapPython = findBootstrapPython();
  if (!bootstrapPython) {
    throw new Error("Python was not found. Install Python 3 and rerun `qarma-tui setup`.");
  }

  const paths = getManagedRuntimePaths();
  mkdirSync(paths.runtimeDir, { recursive: true });
  mkdirSync(paths.configDir, { recursive: true });

  const requirementsPath = requirementsPathFrom(importMetaUrl);
  const pythonModuleDir = pythonModuleDirFrom(importMetaUrl);
  const managedPython = getManagedPythonBin(paths.venvDir);

  if (!existsSync(managedPython)) {
    runStep("1. Creating local runtime", bootstrapPython, ["-m", "venv", paths.venvDir]);
  } else {
    console.log("1. Reusing existing local runtime");
  }

  runStep("2. Upgrading pip", managedPython, ["-m", "pip", "install", "--upgrade", "pip"]);
  runStep("3. Installing Python dependencies", managedPython, [
    "-m",
    "pip",
    "install",
    "-r",
    requirementsPath,
  ]);

  console.log("4. Verifying local runner");
  const validation = validateLocalRunnerImports(managedPython, pythonModuleDir);
  if (!validation.ok) {
    throw new Error(validation.detail);
  }

  writeManagedRuntimeMetadata(bootstrapPython);

  if (macosKeychainStore.isAvailable()) {
    const rl = createInterface({ input, output });
    const shouldSaveKey = await promptYesNo(rl, "Save an OpenAI API key now?");
    rl.close();

    if (shouldSaveKey) {
      const key = await promptSecret("OpenAI API key: ");
      if (key) {
        macosKeychainStore.set("openai_api_key", key);
        console.log("5. OpenAI key saved to macOS Keychain");
      } else {
        console.log("5. Skipped OpenAI key save");
      }
    } else {
      console.log("5. Skipped OpenAI key save");
    }
  } else {
    console.log("5. Secure key storage is not available on this platform yet");
  }

  console.log("\nSetup complete.");
  console.log("Run `qarma-tui doctor` to verify or start the app with `qarma-tui`.");
}
