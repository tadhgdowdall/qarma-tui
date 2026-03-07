# Qarma TUI Architecture

This project should stay simple, open source, and easy to contribute to.

The goal is not to copy OpenCode exactly. The goal is to borrow the parts that scale well:

- clear separation of concerns
- small focused modules
- UI separated from business logic
- room to grow without turning into a monolith

This document describes the recommended layout for Qarma TUI.

## Principles

Keep the project lightweight:

- One repo
- One app package for now
- Clear folders by responsibility
- Avoid deep abstractions until needed

Design for growth:

- Keep terminal UI code out of business logic
- Keep API code out of UI files
- Prefer small feature modules over large shared frameworks
- Make it easy for contributors to find where things belong

Build around Qarma's real product needs:

- run tests locally against `localhost` and private environments
- run tests against live public URLs
- support Qarma-managed execution and bring-your-own model access
- reuse the existing Qarma cloud architecture instead of duplicating it

## Recommended Structure

```text
src/
  index.ts
  tui/
    app.ts
    routes/
      home.ts
      orders.ts
      session.ts
    layout/
      shell.ts
      sidebar.ts
      transcript.ts
      composer.ts
      statusbar.ts
    components/
      pane.ts
      list.ts
      dialog.ts
      empty-state.ts
    state/
      app-state.ts
      orders-state.ts
      session-state.ts
      ui-state.ts
    commands/
      registry.ts
      navigation.ts
      orders.ts
      sessions.ts
    context/
      config.ts
      services.ts

  core/
    models/
      order.ts
      queue.ts
      session.ts
      alert.ts
    ports/
      qarma-api.ts
      storage.ts
      logger.ts
    usecases/
      load-orders.ts
      get-order.ts
      retry-order.ts
      send-message.ts

  infra/
    api/
      client.ts
      auth.ts
      streaming.ts
    local/
      browseruse-runner.ts
      llm/
        openai.ts
        anthropic.ts
        google.ts
        openrouter.ts
        ollama.ts
    storage/
      files.ts
      local-cache.ts
    logging/
      logger.ts

  shared/
    types.ts
    errors.ts
    constants.ts
    utils.ts

test/
  unit/
  integration/
  tui/
```

## Folder Responsibilities

### `src/index.ts`
App entrypoint.

This file should:

- load config
- create dependencies
- boot the TUI app

It should not contain screen layout or business logic.

### `src/tui/`
Terminal UI only.

This folder owns:

- layout
- routes
- dialogs
- keyboard handling
- focus management
- UI state

It should not make raw API calls directly.

### `src/core/`
Business logic.

This folder owns:

- domain models
- use cases
- interfaces for services

Examples:

- load orders
- retry a failed job
- send a prompt/message
- fetch order details

This layer should be mostly framework-free and easy to test.

### `src/infra/`
Real implementations of external systems.

This folder owns:

- HTTP API clients
- auth handling
- local storage
- logging
- event streaming
- local Browser-Use execution
- LLM provider adapters

This is where outside systems touch the app.

### `src/shared/`
Small shared utilities.

Keep this small. Do not let it become a dump folder.

Good candidates:

- shared types
- constants
- common errors
- tiny helpers

## Separation of Concerns

Use this rule:

- `tui` renders and handles interaction
- `core` decides what should happen
- `infra` talks to the outside world

Example:

1. User presses `r` on an order
2. TUI triggers a command
3. Command calls a use case in `core`
4. Use case calls the API interface
5. `infra/api/client.ts` performs the request
6. State updates
7. TUI rerenders

That flow keeps the app predictable.

For test execution specifically:

- `tui` chooses what the user wants to run
- `core` decides which execution path to use
- `infra` runs the test locally or sends it to Qarma cloud

## Execution Model

Qarma TUI should support both local and cloud execution.

The TUI is not the source of truth for tests and runs. It is a client for the Qarma system.

### Execution modes

Support these modes:

1. `local-browser + user model`
2. `cloud-browser + Qarma managed model`
3. `local-browser + Qarma managed model` (optional later)

This keeps the product flexible without making the architecture heavy.

### What local execution means

Local execution should:

- run Browser-Use on the user's machine
- access `localhost`, private URLs, and public URLs
- use the user's own API key or local model setup
- stream steps live to the TUI
- optionally sync results back to Qarma

### What cloud execution means

Cloud execution should:

- use the existing Qarma backend and test run flow
- create or trigger runs in the same system as the web app
- stream updates from Firestore or backend events
- be the default for public/team/shared runs

## Model Provider Options

Keep model support simple and practical.

Recommended options:

- `Qarma managed`
- `Your OpenAI key`
- `Your Anthropic key`
- `Your Gemini key`
- `Your OpenRouter key`
- `Local Ollama`

Important note:

Do not frame this as using a chat app subscription directly.
In most cases, what the product can really support is:

- provider API keys
- local model runtimes
- Qarma-managed model access

## Suggested Runtime Decision Rules

Use sensible defaults:

- `localhost`, `127.0.0.1`, private IPs, `.local` domains → default to `local`
- public HTTPS URLs → default to `cloud`
- if no local provider is configured → default to `Qarma managed`

Users should still be able to override the default.

## Ports and Interfaces

The TUI should depend on interfaces, not direct implementations.

Suggested core ports:

```ts
export interface QarmaClient {
  listTests(workspaceId: string): Promise<Test[]>;
  runSavedTest(testId: string): Promise<{ runId: string }>;
  createPromptRun(input: {
    workspaceId: string;
    prompt: string;
    targetUrl: string;
  }): Promise<{ runId: string }>;
  subscribeToRun(runId: string, onUpdate: (run: TestRun) => void): () => void;
}

export interface LocalRunner {
  runPrompt(input: {
    url: string;
    prompt: string;
    headless?: boolean;
    provider: ModelProviderConfig;
    onStep?: (step: TestRunStep) => void;
  }): Promise<TestResult>;
}
```

This keeps the TUI independent from:

- Firebase details
- Browser-Use implementation details
- provider-specific SDKs

## Secrets and Provider Configuration

For open source and user trust, secrets should stay local by default.

Store provider credentials in:

- macOS Keychain
- Windows Credential Manager
- Linux secret store

Fallback to encrypted local storage only if needed.

Avoid storing raw provider API keys in Firestore by default.

## Integration with Qarma Cloud

Qarma TUI should fit the existing platform, not replace it.

Use the current Qarma backend for:

- saved tests
- workspace auth
- cloud test execution
- run history
- team-visible results

Use local execution for:

- `localhost`
- private staging
- developer environments
- optional public URL runs using user-provided model access

This gives one product with two execution paths.

## State Guidelines

Keep state split into three groups:

### Server state
Data loaded from Qarma:

- orders
- sessions
- alerts
- queue status

### UI state
Local interface state:

- active route
- focused pane
- selected order
- open dialog
- input text

### Workflow state
Temporary action state:

- loading
- retry in progress
- pending confirmation
- streaming response
- current execution mode
- current model provider

Do not store everything in one giant global object.

## Route and Layout Pattern

Keep the UI structure simple:

- `Shell`
- `Sidebar`
- `Main route`
- `Composer`
- `Status bar`
- `Dialogs`

Suggested routes:

- `home`
- `orders`
- `session`

Start small. Add more only when needed.

## Commands and Keybindings

Do not hardcode all behavior inline inside UI components.

Use a small command layer:

- `commands/registry.ts`
- feature command files like `orders.ts` and `navigation.ts`

That makes it easier to:

- test actions
- remap keys
- add command palette support later

Example idea:

- `order.retry`
- `order.open`
- `session.switch`
- `nav.focusSidebar`
- `run.local`
- `run.cloud`
- `provider.switch`

## Open Source Guidance

Because this project is open source, the layout should optimize for readability.

Prefer:

- small files
- clear names
- shallow folder depth
- minimal magic

Avoid:

- too many base classes
- hidden side effects
- global singleton state everywhere
- clever abstractions without clear value

Contributors should be able to answer:

- where does this screen live?
- where does this action live?
- where does the API call live?
- where does local execution live?
- where does cloud execution live?
- where do model provider integrations live?

## Keep It Lightweight

Do not introduce all folders at once if they are empty.

Start with:

```text
src/
  index.ts
  tui/
    app.ts
    routes/
    layout/
    state/
    commands/
  core/
    models/
    ports/
    usecases/
  infra/
    api/
  shared/
```

Add the rest when the project actually needs them.

## Suggested First Milestones

### Phase 1

- basic shell
- sidebar
- transcript
- prompt input
- mock data
- execution mode selector
- provider selector

### Phase 2

- real Qarma API client
- local Browser-Use runner integration
- live step streaming
- keyboard navigation

### Phase 3

- saved tests from Qarma
- cloud run trigger
- result sync
- command system
- dialogs
- local persistence

### Phase 4

- extract reusable runner or SDK packages if needed

Only split into multiple packages when there is clear pressure to do so.

## Summary

Qarma TUI should be:

- simpler than OpenCode
- structured enough to scale
- easy for open-source contributors to follow
- able to run both local and cloud natural-language tests
- flexible about who provides the model access

The main idea is:

- `tui` for terminal UI
- `core` for app logic
- `infra` for integrations
- `shared` for small common helpers

That is a good starting point for a high-quality, maintainable TUI product.
