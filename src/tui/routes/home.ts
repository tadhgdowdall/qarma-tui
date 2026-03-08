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
import { sampleMessages, sampleSessions } from "../state/mock-data";

export function mountHomeRoute(renderer: CliRenderer) {
  const { view: landingView, input: landingInput } = createLandingView(
    renderer,
    handleInitialSubmit,
  );
  const shell = createShell(renderer);
  const sidebar = createSidebar(renderer, sampleSessions);
  const { panel: transcriptPanel, transcript } = createTranscriptPanel(renderer);
  const { composer, input } = createComposer(renderer, handleWorkspaceSubmit);
  const statusbar = createStatusBar(renderer);

  let sidebarOpen = false;
  let sidebarWidth = 0;
  let sidebarAnimation: ReturnType<typeof setInterval> | null = null;
  let workspaceActive = false;
  let transcriptSeeded = false;
  let runInFlight = false;

  function seedTranscript() {
    if (transcriptSeeded) {
      return;
    }

    for (const message of sampleMessages) {
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
    addTranscriptMessage(renderer, transcript, {
      speaker: "Operator",
      accent: "#f8fafc",
      content: trimmed,
    });
  }

  function appendStepMessage(step: TestRunStep) {
    addTranscriptMessage(renderer, transcript, {
      speaker: "Qarma",
      accent: step.status === "failed" ? "#f87171" : "#f97316",
      content: `${step.title}${step.observation ? ` — ${step.observation}` : ""}`,
    });
  }

  function appendRunSummary(run: TestRun) {
    const summary =
      run.status === "passed"
        ? `Run passed on ${run.targetUrl} using ${run.executionMode} execution.`
        : `Run ${run.status} on ${run.targetUrl}${run.errorMessage ? `: ${run.errorMessage}` : "."}`;

    addTranscriptMessage(renderer, transcript, {
      speaker: "System",
      accent: run.status === "passed" ? "#4ade80" : "#f87171",
      content: summary,
    });
  }

  function buildRunRequest(prompt: string): RunRequest {
    return {
      workspaceId: "demo-workspace",
      prompt,
      triggeredBy: "manual",
      runConfig: {
        executionMode: "local",
        modelSource: "user_api_key",
        modelProvider: "openai",
        providerProfileId: "openai-local",
        browser: "chromium",
        headless: false,
        timeoutSeconds: 60,
        targetUrlOverride: "http://localhost:3000",
        syncResultsToQarma: true,
      },
    };
  }

  async function submitRun(value: string) {
    const trimmed = value.trim();
    if (!trimmed || runInFlight) {
      return;
    }

    appendPromptExchange(trimmed);
    runInFlight = true;

    addTranscriptMessage(renderer, transcript, {
      speaker: "System",
      accent: "#a3a3a3",
      content: "Starting local run on http://localhost:3000 with OpenAI.",
    });

    try {
      const run = await startRun(
        buildRunRequest(trimmed),
        {
          localRunner: services.localRunner,
          qarmaApi: services.qarmaApi,
        },
        {
          onStep: appendStepMessage,
        },
      );

      appendRunSummary(run);
    } catch (error) {
      addTranscriptMessage(renderer, transcript, {
        speaker: "System",
        accent: "#f87171",
        content: `Run failed to start: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      runInFlight = false;
    }
  }

  function handleInitialSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    activateWorkspace();
    void submitRun(trimmed);
    landingInput.value = "";
  }

  function handleWorkspaceSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    void submitRun(trimmed);
    input.value = "";
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
  };

  renderer.keyInput.on("keypress", (key) => {
    if (!workspaceActive) {
      return;
    }

    if (key.name === "tab") {
      sidebarOpen = !sidebarOpen;
      syncSidebar();
    }
  });

  shell.app.add(sidebar);
  shell.main.add(transcriptPanel);
  shell.main.add(composer);
  shell.main.add(statusbar);
  shell.app.add(shell.main);
  shell.app.visible = false;
  sidebar.width = 0;
  sidebar.visible = false;
  renderer.root.add(landingView);
  renderer.root.add(shell.app);
  landingInput.focus();
}
