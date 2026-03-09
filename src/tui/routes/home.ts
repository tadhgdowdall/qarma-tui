import type { CliRenderer } from "@opentui/core";
import type { RunRequest, TestRun, TestRunStep } from "../../core/models/run";
import { startRun } from "../../core/usecases/start-run";
import { createLandingView } from "../layout/landing";
import { services } from "../context/services";
import { createShell } from "../layout/shell";
import { createSidebar } from "../layout/sidebar";
import { createTranscriptPanel, addTranscriptMessage } from "../layout/transcript";
import { createComposer } from "../layout/composer";
import { createStatusBar } from "../layout/statusbar";
import { applySettingsCommand, getCommandSuggestions, shouldAcceptSuggestion } from "../commands/settings";
import { sampleMessages } from "../state/mock-data";
import { buildRunRequest, defaultRunSettings, formatRunSettings } from "../state/run-settings";
import type { Message, RecentRunSummary } from "../../shared/types";
import { copyTextToClipboard } from "../../infra/local/clipboard";

export function mountHomeRoute(renderer: CliRenderer) {
  const runSettings = { ...defaultRunSettings };
  const { view: landingView, input: landingInput } = createLandingView(
    renderer,
    handleInitialSubmit,
  );
  const shell = createShell(renderer);
  const recentRuns: RecentRunSummary[] = [];
  const sidebarState = createSidebar(renderer, recentRuns);
  const sidebar = sidebarState.sidebar;
  const { panel: transcriptPanel, transcript } = createTranscriptPanel(renderer);
  const { composer, input, updateSuggestions, hideSuggestions } = createComposer(renderer, handleWorkspaceSubmit);
  const statusbar = createStatusBar(renderer, runSettings);

  let sidebarOpen = false;
  let sidebarWidth = 0;
  let sidebarAnimation: ReturnType<typeof setInterval> | null = null;
  let workspaceActive = false;
  let transcriptSeeded = false;
  let runInFlight = false;
  let lastSubmittedPrompt = "";
  let activeRunStatus: "idle" | "running" | "passed" | "failed" | "cancelled" = "idle";
  let activeRunStartedAt: number | null = null;
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;
  let commandSelectionIndex = 0;
  let commandMenuOpen = false;
  let sidebarSelectionIndex = 0;
  const transcriptMessages: Message[] = [];

  function truncatePrompt(prompt: string) {
    return prompt.replace(/\s+/g, " ").trim().slice(0, 44);
  }

  function formatRelativeTime(timestamp: number) {
    const deltaSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (deltaSeconds < 5) return "just now";
    if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
    const minutes = Math.floor(deltaSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  function syncRecentRuns() {
    recentRuns.forEach((run, index) => {
      run.active = sidebarOpen && index === sidebarSelectionIndex;
      run.subtitle = formatRelativeTime(Number(run.id.split("-").pop() || Date.now()));
    });
    sidebarState.update(recentRuns);
  }

  function addRecentRun(prompt: string) {
    const timestamp = Date.now();
    const entry: RecentRunSummary = {
      id: `run-${timestamp}`,
      prompt: truncatePrompt(prompt),
      target: runSettings.targetUrl.replace(/^https?:\/\//, ""),
      status: "running",
      subtitle: "just now",
      active: false,
    };
    recentRuns.unshift(entry);
    if (recentRuns.length > 12) {
      recentRuns.length = 12;
    }
    sidebarSelectionIndex = 0;
    syncRecentRuns();
    return entry;
  }

  function updateRecentRun(entry: RecentRunSummary, status: RecentRunSummary["status"]) {
    entry.status = status;
    syncRecentRuns();
  }

  function stopElapsedTimer() {
    if (elapsedTimer) {
      clearInterval(elapsedTimer);
      elapsedTimer = null;
    }
  }

  function elapsedSeconds() {
    if (!activeRunStartedAt) {
      return 0;
    }
    return Math.max(0, Math.floor((Date.now() - activeRunStartedAt) / 1000));
  }

  function normalizeRunStatus(status: TestRun["status"]) {
    return status === "queued" ? "running" : status;
  }

  function seedTranscript() {
    if (transcriptSeeded) {
      return;
    }

    for (const message of sampleMessages) {
      transcriptMessages.push(message);
      addTranscriptMessage(renderer, transcript, message);
    }

    transcriptSeeded = true;
  }

  function activateWorkspace() {
    if (workspaceActive) {
      return;
    }

    workspaceActive = true;
    landingView.visible = false;
    shell.app.visible = true;
    seedTranscript();
    syncSidebar();
    input.focus();
    renderer.root.requestRender();
  }

  function appendPromptExchange(trimmed: string) {
    const message = {
      speaker: "Operator",
      accent: "#f8fafc",
      content: trimmed,
      variant: "prompt",
    } as const;
    transcriptMessages.push(message);
    addTranscriptMessage(renderer, transcript, message);
  }

  function compactStepTitle(title: string) {
    return title
      .replace(/\s+/g, " ")
      .replace(/^Verify presence of /i, "Check ")
      .replace(/^Verify that /i, "Check ")
      .replace(/^Click on /i, "Click ")
      .replace(/^No further actions required.*$/i, "Finish run")
      .replace(/^Prepare to report results.*$/i, "Finish run")
      .trim()
      .slice(0, 96);
  }

  function compactStepLine(label: string, value: string) {
    const compactValue = value
      .replace(/\s+/g, " ")
      .replace(/^Pending:\s*/i, "")
      .replace(/^Status:\s*/i, "")
      .trim()
      .slice(0, 120);

    return compactValue ? `${label}  ${compactValue}` : null;
  }

  function appendStepMessage(step: TestRunStep) {
    if (step.title === "Runner started" || step.title === "Resolve model access") {
      return;
    }

    const noteLine = step.observation
      ? compactStepLine("note", step.observation)
      : null;

    const message = {
      speaker: "Qarma",
      accent: step.status === "failed" ? "#f87171" : "#f97316",
      content: compactStepTitle(step.title),
      detailLines: noteLine ? [noteLine] : [],
      stepStatus: step.status,
      variant: "step",
    } as const;
    transcriptMessages.push(message);
    addTranscriptMessage(renderer, transcript, message);
  }

  function appendOptimisticStartupStep() {
    const message: Message = {
      speaker: "Qarma",
      accent: "#f97316",
      content: "Starting local browser session",
      detailLines: [],
      stepStatus: "running",
      variant: "step",
    };
    transcriptMessages.push(message);
    addTranscriptMessage(renderer, transcript, message);
  }

  function appendRunSummary(run: TestRun) {
    const summary =
      run.status === "passed"
        ? run.result || `Run passed on ${run.targetUrl}.`
        : `Run ${run.status} on ${run.targetUrl}${run.errorMessage ? `: ${run.errorMessage}` : "."}`;

    const message = {
      speaker: "System",
      accent: run.status === "passed" ? "#4ade80" : "#f87171",
      content: summary,
      variant: "system",
    } as const;
    transcriptMessages.push(message);
    addTranscriptMessage(renderer, transcript, message);
  }

  function appendSystemMessage(content: string, accent = "#a3a3a3") {
    const message = {
      speaker: "System",
      accent,
      content,
      variant: "system",
    } as const;
    transcriptMessages.push(message);
    addTranscriptMessage(renderer, transcript, message);
  }

  function syncStatusbar() {
    statusbar.update(runSettings, {
      status: activeRunStatus,
      elapsedSeconds: elapsedSeconds(),
    });
    renderer.root.requestRender();
  }

  function currentCommandSuggestions() {
    return getCommandSuggestions(input.plainText);
  }

  function refreshCommandMenu() {
    const trimmed = input.plainText.trimStart();
    const suggestions = getCommandSuggestions(input.plainText);
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

  function copyLatestTranscriptMessage() {
    const selectedText = renderer.getSelection()?.getSelectedText().trim();
    if (selectedText) {
      const copied = copyTextToClipboard(renderer, selectedText);

      if (!copied) {
        appendSystemMessage(
          "Clipboard copy is not supported by this terminal.",
          "#f87171",
        );
      }
      return;
    }

    const lastMessage = transcriptMessages[transcriptMessages.length - 1];
    if (!lastMessage) {
      appendSystemMessage("Nothing to copy yet.", "#a3a3a3");
      return;
    }

    const copied = copyTextToClipboard(
      renderer,
      `${lastMessage.speaker}: ${lastMessage.content}`,
    );

    if (!copied) {
      appendSystemMessage(
        "Clipboard copy is not supported by this terminal.",
        "#f87171",
      );
    }
  }

  async function submitRun(value: string) {
    const trimmed = value.trim();
    if (!trimmed || runInFlight) {
      return;
    }

    lastSubmittedPrompt = trimmed;
    const recentRun = addRecentRun(trimmed);
    appendPromptExchange(trimmed);
    runInFlight = true;
    activeRunStatus = "running";
    activeRunStartedAt = Date.now();
    stopElapsedTimer();
    elapsedTimer = setInterval(syncStatusbar, 1000);
    syncStatusbar();
    appendOptimisticStartupStep();
    renderer.root.requestRender();

    await new Promise((resolve) => setTimeout(resolve, 0));

    const openAiKeySource = await services.secrets.source("openai_api_key");
    if (openAiKeySource === "missing") {
      appendSystemMessage("OpenAI key is missing for the current session.", "#f87171");
    } else {
      appendSystemMessage(`Local run · ${formatRunSettings(runSettings)}`, "#737373");
    }

    try {
      const run = await startRun(
        buildRunRequest(trimmed, runSettings),
        {
          localRunner: services.localRunner,
          qarmaApi: services.qarmaApi,
        },
        {
          onStep: appendStepMessage,
        },
      );

      activeRunStatus = normalizeRunStatus(run.status);
      updateRecentRun(recentRun, run.status === "queued" ? "running" : run.status);
      appendRunSummary(run);
    } catch (error) {
      activeRunStatus = "failed";
      updateRecentRun(recentRun, "failed");
      appendSystemMessage(
        `Run failed to start: ${error instanceof Error ? error.message : String(error)}`,
        "#f87171",
      );
    } finally {
      runInFlight = false;
      stopElapsedTimer();
      syncStatusbar();
    }
  }

  function handleInitialSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    activateWorkspace();
    void submitRun(trimmed);
    landingInput.clear();
  }

  async function handleWorkspaceSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    const suggestions = currentCommandSuggestions();
    const selectedSuggestion = suggestions[commandSelectionIndex];

    if (commandMenuOpen && selectedSuggestion && shouldAcceptSuggestion(trimmed, selectedSuggestion)) {
      input.setText(selectedSuggestion.insertValue);
      syncCommandSuggestions();
      input.focus();
      return;
    }

    if (trimmed === "/clear") {
      stopElapsedTimer();
      activeRunStatus = "idle";
      activeRunStartedAt = null;
      transcriptMessages.length = 0;
      for (const child of transcript.getChildren()) {
        transcript.remove(child.id);
      }
      input.clear();
      input.focus();
      syncStatusbar();
      renderer.root.requestRender();
      return;
    }

    if (trimmed === "/rerun") {
      if (!lastSubmittedPrompt) {
        appendSystemMessage("No previous prompt to rerun.", "#f87171");
      } else if (runInFlight) {
        appendSystemMessage("A run is already in progress.", "#f87171");
      } else {
        void submitRun(lastSubmittedPrompt);
      }
      input.clear();
      input.focus();
      return;
    }

    if (trimmed === "/cancel") {
      if (!runInFlight) {
        appendSystemMessage("No run is currently in progress.", "#f87171");
      } else {
        const cancelled = await services.localRunner.cancelCurrentRun();
        if (cancelled) {
          activeRunStatus = "cancelled";
          stopElapsedTimer();
          syncStatusbar();
        }
        appendSystemMessage(
          cancelled ? "Cancelling current run..." : "No active local process to cancel.",
          cancelled ? "#f97316" : "#f87171",
        );
      }
      input.clear();
      input.focus();
      return;
    }

    const commandResult = await applySettingsCommand(trimmed, runSettings, services.secrets);
    if (commandResult.kind === "message") {
      appendSystemMessage(commandResult.content, commandResult.accent);
      syncStatusbar();
      commandMenuOpen = false;
      hideSuggestions();
      input.clear();
      input.focus();
      return;
    }

    void submitRun(trimmed);
    commandMenuOpen = false;
    hideSuggestions();
    input.clear();
    input.focus();
  }

  const stopSidebarAnimation = () => {
    if (sidebarAnimation) {
      clearInterval(sidebarAnimation);
      sidebarAnimation = null;
    }
  };

  const animateSidebar = (targetWidth: number) => {
    stopSidebarAnimation();

    if (sidebarWidth === targetWidth) {
      sidebar.width = sidebarWidth;
      sidebar.visible = targetWidth > 0;
      shell.app.requestRender();
      return;
    }

    sidebar.visible = true;

    sidebarAnimation = setInterval(() => {
      if (sidebarWidth === targetWidth) {
        stopSidebarAnimation();
        if (targetWidth === 0) {
          sidebar.visible = false;
        }
        return;
      }

      const direction = sidebarWidth < targetWidth ? 1 : -1;
      sidebarWidth += direction * 4;

      if ((direction > 0 && sidebarWidth > targetWidth) || (direction < 0 && sidebarWidth < targetWidth)) {
        sidebarWidth = targetWidth;
      }

      sidebar.width = sidebarWidth;
      shell.app.requestRender();
    }, 16);
  };

  const syncSidebar = () => {
    animateSidebar(sidebarOpen ? 24 : 0);
    syncRecentRuns();
  };

  renderer.keyInput.on("keypress", (key) => {
    if (!workspaceActive && key.ctrl && key.name === "g") {
      activateWorkspace();
      return;
    }

    if (!workspaceActive) {
      return;
    }

    if (key.name === "tab") {
      sidebarOpen = !sidebarOpen;
      syncSidebar();
      return;
    }

    if (sidebarOpen && !commandMenuOpen && key.name === "down" && recentRuns.length > 0) {
      sidebarSelectionIndex = (sidebarSelectionIndex + 1) % recentRuns.length;
      syncRecentRuns();
      return;
    }

    if (sidebarOpen && !commandMenuOpen && key.name === "up" && recentRuns.length > 0) {
      sidebarSelectionIndex = (sidebarSelectionIndex - 1 + recentRuns.length) % recentRuns.length;
      syncRecentRuns();
      return;
    }

    if (sidebarOpen && !commandMenuOpen && (key.name === "return" || key.name === "linefeed")) {
      const selectedRun = recentRuns[sidebarSelectionIndex];
      if (selectedRun && !runInFlight) {
        void submitRun(selectedRun.prompt);
        input.focus();
      }
      return;
    }

    if (key.name === "down") {
      const suggestions = currentCommandSuggestions();
      if (suggestions.length > 0) {
        if (!commandMenuOpen) {
          commandMenuOpen = true;
          commandSelectionIndex = 0;
        } else {
          commandSelectionIndex = (commandSelectionIndex + 1) % suggestions.length;
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
        commandSelectionIndex = (commandSelectionIndex - 1 + suggestions.length) % suggestions.length;
        updateSuggestions(suggestions, commandSelectionIndex);
        return;
      }
    }

    if (key.ctrl && key.name === "y") {
      copyLatestTranscriptMessage();
    }

    if (!key.ctrl && !key.meta) {
      refreshCommandMenuSoon();
    }
  });

  shell.app.add(sidebar);
  shell.main.add(transcriptPanel);
  shell.main.add(composer);
  shell.main.add(statusbar.statusbar);
  shell.app.add(shell.main);
  shell.app.visible = false;
  sidebar.width = 0;
  sidebar.visible = false;
  renderer.root.add(landingView);
  renderer.root.add(shell.app);
  input.on("input", () => {
    refreshCommandMenu();
  });
  landingInput.focus();
  syncStatusbar();
}
