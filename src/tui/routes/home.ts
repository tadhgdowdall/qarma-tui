import type { CliRenderer } from "@opentui/core";
import { createLandingView } from "../layout/landing";
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

    addTranscriptMessage(renderer, transcript, {
      speaker: "Qarma",
      accent: "#5eead4",
      content:
        "Acknowledged. This is still a UI stub, but the prompt path is now wired and ready for real command handling.",
    });
  }

  function handleInitialSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    activateWorkspace();
    appendPromptExchange(trimmed);
    landingInput.value = "";
  }

  function handleWorkspaceSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    appendPromptExchange(trimmed);
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
