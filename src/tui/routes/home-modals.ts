import type { CliRenderer, TextareaRenderable } from "@opentui/core";
import { createPickerModal } from "../layout/picker-modal";
import { createSecretModal } from "../layout/secret-modal";
import {
  searchCommandSuggestions,
  searchModelOptions,
  searchTargetOptions,
} from "../commands/settings";
import type { RunSettings } from "../state/run-settings";
import type { MutableSecretStore } from "../../infra/storage/session-secret-store";
import { macosKeychainStore } from "../../infra/storage/macos-keychain-store";

type HomeKey = {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  sequence?: string;
};

type HomePaste = {
  text: string;
};

type HomeModalControllerOptions = {
  renderer: CliRenderer;
  runSettings: RunSettings;
  workspaceInput: TextareaRenderable;
  landingInput: TextareaRenderable;
  appendSystemMessage: (content: string, accent?: string) => void;
  syncStatusbar: () => void;
  handleWorkspaceSubmit: (value: string) => Promise<void>;
  isWorkspaceActive: () => boolean;
  secrets: MutableSecretStore;
};

export function createHomeModalController(
  options: HomeModalControllerOptions,
) {
  const commandPalette = createPickerModal(
    options.renderer,
    "Commands",
    "Search commands...",
  );
  const modelPicker = createPickerModal(
    options.renderer,
    "Models",
    "Search models...",
  );
  const targetPicker = createPickerModal(
    options.renderer,
    "Target",
    "Search targets or type a domain...",
  );
  const sessionKeyPrompt = createSecretModal(
    options.renderer,
    "Session OpenAI key",
    "Enter to save for this session. Esc to cancel.",
  );
  const persistedKeyPrompt = createSecretModal(
    options.renderer,
    "Secure OpenAI key",
    "Enter to save to secure local storage. Esc to cancel.",
  );

  let modalSelectionIndex = 0;
  let secretBuffer = "";
  let ignoreNextSecretSubmit = false;
  let activeModal:
    | "commands"
    | "models"
    | "targets"
    | "session-key"
    | "persisted-key"
    | null = null;

  function currentCommandPaletteItems() {
    return searchCommandSuggestions(commandPalette.search.value || "");
  }

  function currentModelPickerItems() {
    return searchModelOptions(modelPicker.search.value || "");
  }

  function currentTargetPickerItems() {
    return searchTargetOptions(
      targetPicker.search.value || "",
      options.runSettings.targetUrl,
    );
  }

  function currentPickerItems() {
    return activeModal === "commands"
      ? currentCommandPaletteItems()
      : activeModal === "models"
        ? currentModelPickerItems()
        : activeModal === "targets"
          ? currentTargetPickerItems()
          : [];
  }

  function syncModal() {
    const activeItems = currentPickerItems();

    if (modalSelectionIndex >= activeItems.length) {
      modalSelectionIndex = 0;
    }

    commandPalette.overlay.visible = activeModal === "commands";
    modelPicker.overlay.visible = activeModal === "models";
    targetPicker.overlay.visible = activeModal === "targets";
    sessionKeyPrompt.overlay.visible = activeModal === "session-key";
    persistedKeyPrompt.overlay.visible = activeModal === "persisted-key";

    commandPalette.update(
      activeModal === "commands"
        ? currentCommandPaletteItems().map((item) => ({
            id: item.command,
            label: item.insertValue,
            summary: item.summary,
          }))
        : [],
      modalSelectionIndex,
    );

    modelPicker.update(
      activeModal === "models"
        ? currentModelPickerItems().map((item) => ({
            id: item.id,
            label: item.label,
            summary: item.summary,
          }))
        : [],
      modalSelectionIndex,
    );

    targetPicker.update(
      activeModal === "targets"
        ? currentTargetPickerItems().map((item) => ({
            id: item.id,
            label: item.label,
            summary: item.summary,
          }))
        : [],
      modalSelectionIndex,
    );

    if (activeModal === "session-key") {
      sessionKeyPrompt.update(secretBuffer);
    }

    if (activeModal === "persisted-key") {
      persistedKeyPrompt.update(secretBuffer);
    }

    options.renderer.root.requestRender();
  }

  function focusActiveInput() {
    if (options.isWorkspaceActive()) {
      options.workspaceInput.focus();
      return;
    }
    options.landingInput.focus();
  }

  function blurInputs() {
    options.workspaceInput.blur();
    options.landingInput.blur();
  }

  function closeModal() {
    sessionKeyPrompt.stopCursor();
    persistedKeyPrompt.stopCursor();
    activeModal = null;
    modalSelectionIndex = 0;
    secretBuffer = "";
    ignoreNextSecretSubmit = false;
    commandPalette.search.clear();
    modelPicker.search.clear();
    targetPicker.search.clear();
    syncModal();
    focusActiveInput();
  }

  function openCommandPalette() {
    blurInputs();
    activeModal = "commands";
    modalSelectionIndex = 0;
    commandPalette.search.clear();
    syncModal();
    commandPalette.search.focus();
  }

  function openModelPicker() {
    blurInputs();
    activeModal = "models";
    modelPicker.search.clear();
    const items = currentModelPickerItems();
    const activeIndex = items.findIndex(
      (item) => item.id === options.runSettings.modelId,
    );
    modalSelectionIndex = activeIndex >= 0 ? activeIndex : 0;
    syncModal();
    modelPicker.search.focus();
  }

  function openTargetPicker() {
    blurInputs();
    activeModal = "targets";
    targetPicker.search.clear();
    const items = currentTargetPickerItems();
    const activeIndex = items.findIndex(
      (item) => item.url === options.runSettings.targetUrl,
    );
    modalSelectionIndex = activeIndex >= 0 ? activeIndex : 0;
    syncModal();
    targetPicker.search.focus();
  }

  function openSessionKeyPrompt() {
    blurInputs();
    activeModal = "session-key";
    secretBuffer = "";
    ignoreNextSecretSubmit = true;
    syncModal();
    sessionKeyPrompt.startCursor();
  }

  function openPersistedKeyPrompt() {
    blurInputs();
    activeModal = "persisted-key";
    secretBuffer = "";
    ignoreNextSecretSubmit = true;
    syncModal();
    persistedKeyPrompt.startCursor();
  }

  async function selectActiveModalItem() {
    if (activeModal === "commands") {
      const selected = currentCommandPaletteItems()[modalSelectionIndex];
      if (!selected) {
        return;
      }

      closeModal();
      if (selected.requiresArgument) {
        options.workspaceInput.setText(selected.insertValue);
        options.workspaceInput.focus();
        return;
      }
      await options.handleWorkspaceSubmit(selected.insertValue);
      return;
    }

    if (activeModal === "models") {
      const selected = currentModelPickerItems()[modalSelectionIndex];
      if (!selected) {
        return;
      }

      options.runSettings.modelId = selected.id;
      options.appendSystemMessage(`Model updated to ${selected.id}.`, "#4ade80");
      options.syncStatusbar();
      closeModal();
      return;
    }

    if (activeModal === "targets") {
      const selected = currentTargetPickerItems()[modalSelectionIndex];
      if (!selected) {
        return;
      }

      options.runSettings.targetUrl = selected.url;
      options.runSettings.targetPreset = selected.preset;
      options.appendSystemMessage(
        `Target updated to ${selected.url}.`,
        "#4ade80",
      );
      options.syncStatusbar();
      closeModal();
      return;
    }

    if (activeModal === "session-key") {
      const secret = secretBuffer.trim();
      if (!secret) {
        options.appendSystemMessage("OpenAI key entry cancelled.", "#f97316");
        closeModal();
        return;
      }

      options.secrets.set("openai_api_key", secret);
      options.appendSystemMessage(
        "OpenAI key loaded for this session only.",
        "#4ade80",
      );
      closeModal();
      return;
    }

    if (activeModal === "persisted-key") {
      const secret = secretBuffer.trim();
      if (!secret) {
        options.appendSystemMessage("OpenAI key entry cancelled.", "#f97316");
        closeModal();
        return;
      }

      try {
        macosKeychainStore.set("openai_api_key", secret);
        options.secrets.clear("openai_api_key");
        options.appendSystemMessage(
          "Saved OpenAI key to secure local storage.",
          "#4ade80",
        );
      } catch (error) {
        options.appendSystemMessage(
          error instanceof Error
            ? error.message
            : "Failed to save key to secure local storage.",
          "#f87171",
        );
      }
      closeModal();
    }
  }

  function handleSecretKeypress(key: HomeKey) {
    if (key.name === "escape") {
      closeModal();
      return true;
    }

    if (key.name === "backspace") {
      if (key.ctrl || key.meta) {
        secretBuffer = secretBuffer.replace(/\S+\s*$/, "");
      } else {
        secretBuffer = secretBuffer.slice(0, -1);
      }
      syncModal();
      return true;
    }

    if (key.name === "delete") {
      if (key.ctrl || key.meta) {
        secretBuffer = "";
      }
      syncModal();
      return true;
    }

    if (key.ctrl && key.name === "u") {
      secretBuffer = "";
      syncModal();
      return true;
    }

    if (key.ctrl && key.name === "w") {
      secretBuffer = secretBuffer.replace(/\S+\s*$/, "");
      syncModal();
      return true;
    }

    if (key.name === "return" || key.name === "linefeed") {
      if (ignoreNextSecretSubmit) {
        ignoreNextSecretSubmit = false;
        return true;
      }
      void selectActiveModalItem();
      return true;
    }

    if (
      !key.ctrl &&
      !key.meta &&
      typeof key.sequence === "string" &&
      key.sequence.length > 0 &&
      key.sequence >= " " &&
      key.sequence !== "\u007f"
    ) {
      ignoreNextSecretSubmit = false;
      secretBuffer += key.sequence;
      syncModal();
      return true;
    }

    return true;
  }

  function handleSecretPaste(text: string) {
    const normalized = text.replace(/[\r\n]+/g, "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
    if (!normalized) {
      return true;
    }

    ignoreNextSecretSubmit = false;
    secretBuffer += normalized;
    syncModal();
    return true;
  }

  function handleKeypress(key: HomeKey) {
    if (key.ctrl && key.name === "p") {
      openCommandPalette();
      return true;
    }

    if (!activeModal) {
      return false;
    }

    if (activeModal === "session-key" || activeModal === "persisted-key") {
      return handleSecretKeypress(key);
    }

    if (key.name === "escape") {
      closeModal();
      return true;
    }

    const items = currentPickerItems();

    if (key.name === "down" && items.length > 0) {
      modalSelectionIndex = (modalSelectionIndex + 1) % items.length;
      syncModal();
      return true;
    }

    if (key.name === "up" && items.length > 0) {
      modalSelectionIndex = (modalSelectionIndex - 1 + items.length) % items.length;
      syncModal();
      return true;
    }

    if ((key.name === "return" || key.name === "linefeed") && items.length > 0) {
      void selectActiveModalItem();
      return true;
    }

    return false;
  }

  function handlePaste(event: HomePaste) {
    if (activeModal !== "session-key" && activeModal !== "persisted-key") {
      return false;
    }

    return handleSecretPaste(event.text);
  }

  commandPalette.search.on("input", () => {
    modalSelectionIndex = 0;
    syncModal();
  });
  modelPicker.search.on("input", () => {
    modalSelectionIndex = 0;
    syncModal();
  });
  targetPicker.search.on("input", () => {
    modalSelectionIndex = 0;
    syncModal();
  });

  return {
    overlays: [
      commandPalette.overlay,
      modelPicker.overlay,
      targetPicker.overlay,
      sessionKeyPrompt.overlay,
      persistedKeyPrompt.overlay,
    ],
    openModelPicker,
    openTargetPicker,
    openSessionKeyPrompt,
    openPersistedKeyPrompt,
    handleKeypress,
    handlePaste,
  };
}
