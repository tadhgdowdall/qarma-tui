import type { CliRenderer } from "@opentui/core";
import { createLandingView } from "../layout/landing";
import { createShell } from "../layout/shell";
import { createTranscriptPanel } from "../layout/transcript";
import { createComposer } from "../layout/composer";
import { createStatusBar } from "../layout/statusbar";
import { services } from "../context/services";
import {
  applySettingsCommand,
  getCommandSuggestions,
  shouldAcceptSuggestion,
} from "../commands/settings";
import { defaultRunSettings } from "../state/run-settings";
import { createHomeModalController } from "./home-modals";
import { createHomeRunController } from "./home-runner";
import { createHomeSidebarController } from "./home-sidebar";

type HomeKey = {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
};

export function mountHomeRoute(renderer: CliRenderer) {
  const runSettings = { ...defaultRunSettings };
  const statusbar = createStatusBar(renderer, runSettings);

  let workspaceActive = false;
  let commandSelectionIndex = 0;
  let commandMenuOpen = false;

  const shell = createShell(renderer);
  const sidebarController = createHomeSidebarController({
    renderer,
    requestRender: () => shell.app.requestRender(),
  });
  const { panel: transcriptPanel, transcript } = createTranscriptPanel(
    renderer,
    () => {
      if (workspaceActive) {
        setTimeout(() => {
          input.focus();
        }, 0);
      }
    },
  );
  const { composer, input, updateSuggestions, hideSuggestions } = createComposer(
    renderer,
    handleWorkspaceSubmit,
  );
  const { view: landingView, input: landingInput } = createLandingView(
    renderer,
    handleInitialSubmit,
  );

  function syncStatusbar(status?: "idle" | "running" | "passed" | "failed" | "cancelled", elapsedSeconds?: number) {
    statusbar.update(runSettings, {
      status,
      elapsedSeconds,
    });
    renderer.root.requestRender();
  }

  const runController = createHomeRunController({
    renderer,
    transcript,
    runSettings,
    syncStatusbar: (status, elapsedSeconds) =>
      syncStatusbar(status, elapsedSeconds),
    addRecentRun: (prompt, targetUrl) =>
      sidebarController.addRecentRun(prompt, targetUrl),
    updateRecentRun: (entry, status) =>
      sidebarController.updateRecentRun(entry, status),
  });

  const modalController = createHomeModalController({
    renderer,
    runSettings,
    workspaceInput: input,
    landingInput,
    appendSystemMessage: runController.appendSystemMessage,
    syncStatusbar: () => syncStatusbar(),
    handleWorkspaceSubmit,
    isWorkspaceActive: () => workspaceActive,
  });

  function activateWorkspace() {
    if (workspaceActive) {
      return;
    }

    workspaceActive = true;
    landingView.visible = false;
    shell.app.visible = true;
    runController.seedTranscript();
    sidebarController.syncSidebar();
    input.focus();
    renderer.root.requestRender();
  }

  function currentCommandSuggestions() {
    return getCommandSuggestions(input.plainText);
  }

  function refreshCommandMenu() {
    const trimmed = input.plainText.trimStart();
    const suggestions = currentCommandSuggestions();
    commandMenuOpen = trimmed.startsWith("/") && suggestions.length > 0;
    commandSelectionIndex = 0;

    if (commandMenuOpen) {
      updateSuggestions(suggestions, commandSelectionIndex);
      return;
    }

    hideSuggestions();
  }

  function refreshCommandMenuSoon() {
    setTimeout(() => {
      if (!workspaceActive) {
        return;
      }
      refreshCommandMenu();
    }, 0);
  }

  function syncCommandSuggestions() {
    if (!commandMenuOpen) {
      hideSuggestions();
      return;
    }

    const suggestions = currentCommandSuggestions();
    if (suggestions.length === 0) {
      commandSelectionIndex = 0;
      commandMenuOpen = false;
      hideSuggestions();
      return;
    }

    if (commandSelectionIndex >= suggestions.length) {
      commandSelectionIndex = 0;
    }

    updateSuggestions(suggestions, commandSelectionIndex);
  }

  function resetWorkspaceInput() {
    commandMenuOpen = false;
    hideSuggestions();
    input.clear();
    input.focus();
  }

  function handleInitialSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    landingInput.setText("");
    landingInput.requestRender();
    activateWorkspace();
    void runController.submitRun(trimmed);
  }

  async function handleWorkspaceSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    const suggestions = currentCommandSuggestions();
    const selectedSuggestion = suggestions[commandSelectionIndex];

    if (
      commandMenuOpen &&
      selectedSuggestion &&
      shouldAcceptSuggestion(trimmed, selectedSuggestion)
    ) {
      input.setText(selectedSuggestion.insertValue);
      syncCommandSuggestions();
      input.focus();
      return;
    }

    if (trimmed === "/clear") {
      runController.clearTranscript();
      input.clear();
      input.focus();
      return;
    }

    if (trimmed === "/rerun") {
      await runController.rerunLast();
      input.clear();
      input.focus();
      return;
    }

    if (trimmed === "/cancel") {
      await runController.cancelCurrentRun();
      input.clear();
      input.focus();
      return;
    }

    const commandResult = await applySettingsCommand(
      trimmed,
      runSettings,
      services.secrets,
    );

    if (commandResult.kind === "open-model-picker") {
      input.clear();
      modalController.openModelPicker();
      return;
    }

    if (commandResult.kind === "open-target-picker") {
      input.clear();
      modalController.openTargetPicker();
      return;
    }

    if (commandResult.kind === "message") {
      runController.appendSystemMessage(
        commandResult.content,
        commandResult.accent,
      );
      syncStatusbar();
      resetWorkspaceInput();
      return;
    }

    resetWorkspaceInput();
    await runController.submitRun(trimmed);
  }

  renderer.keyInput.on("keypress", (key: HomeKey) => {
    if (!workspaceActive && key.ctrl && key.name === "g") {
      activateWorkspace();
      return;
    }

    if (!workspaceActive) {
      return;
    }

    if (modalController.handleKeypress(key)) {
      return;
    }

    if (
      sidebarController.handleKeypress(
        key,
        commandMenuOpen,
        runController.isRunInFlight(),
        (prompt) => {
          void runController.submitRun(prompt);
        },
        () => input.focus(),
      )
    ) {
      return;
    }

    if (key.name === "down") {
      const suggestions = currentCommandSuggestions();
      if (suggestions.length > 0) {
        if (!commandMenuOpen) {
          commandMenuOpen = true;
          commandSelectionIndex = 0;
        } else {
          commandSelectionIndex =
            (commandSelectionIndex + 1) % suggestions.length;
        }
        updateSuggestions(suggestions, commandSelectionIndex);
        return;
      }
    }

    if (key.name === "up") {
      if (!commandMenuOpen) {
        return;
      }
      const suggestions = currentCommandSuggestions();
      if (suggestions.length > 0) {
        commandSelectionIndex =
          (commandSelectionIndex - 1 + suggestions.length) % suggestions.length;
        updateSuggestions(suggestions, commandSelectionIndex);
        return;
      }
    }

    if (key.ctrl && key.name === "y") {
      runController.copyLatestTranscriptMessage();
    }

    if (!key.ctrl && !key.meta) {
      refreshCommandMenuSoon();
    }
  });

  shell.app.add(sidebarController.sidebar);
  shell.main.add(transcriptPanel);
  shell.main.add(composer);
  shell.main.add(statusbar.statusbar);
  shell.app.add(shell.main);
  shell.app.visible = false;

  renderer.root.add(landingView);
  renderer.root.add(shell.app);
  for (const overlay of modalController.overlays) {
    renderer.root.add(overlay);
  }

  input.on("input", () => {
    refreshCommandMenu();
  });

  landingInput.focus();
  syncStatusbar("idle", 0);
}
