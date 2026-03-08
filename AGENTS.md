# Repository Guidelines

This is an open source project. Treat everything committed here as public: never commit secrets, credentials, tokens, private keys, internal-only data, or code that knowingly introduces a vulnerability.

## Project Structure & Module Organization
`src/` is split by responsibility. Keep terminal rendering in `src/tui/`, domain models and use cases in `src/core/`, external integrations in `src/infra/`, and small shared helpers in `src/shared/`. The entrypoint is `src/index.ts`, which should only boot the app and wire dependencies. Architectural intent and placement rules are documented in `ARCHITECTURE.md`.

There is no `test/` directory yet. When adding tests, mirror the production layout with focused suites such as `test/unit/` and `test/integration/`.

## Build, Test, and Development Commands
Use Bun for local work:

- `bun install` installs dependencies.
- `bun start` runs the TUI once from `src/index.ts`.
- `bun dev` runs the app in watch mode for iterative development.

Before opening a PR, confirm the app still starts cleanly with `bun start`.

## Coding Style & Naming Conventions
This repository uses TypeScript with ES modules and currently follows simple, consistent conventions:

- Use 2-space indentation and semicolons.
- Prefer named exports for reusable functions.
- Use `kebab-case` for file names such as `app-state.ts` and `provider-profile-store.ts`.
- Keep UI code out of `src/core/` and raw API or storage calls out of `src/tui/`.

Keep modules small and focused. Avoid introducing broad shared abstractions unless they unlock a clear next step.

## Testing Guidelines
Automated tests are not wired up yet, so do not claim coverage that does not exist. For now, validate changes by running `bun start` and exercising the relevant TUI flow manually. If you add a test harness, prefer Bun's built-in test runner and name files `*.test.ts`.

## Commit & Pull Request Guidelines
Git history currently uses Conventional Commits, for example `feat(core): add secure local run skeleton`. Follow that pattern with clear scopes when possible.

PRs should stay small and reviewable. Include:

- a brief description of the user-facing or architectural change
- any tradeoffs or follow-up work
- screenshots or terminal captures for visible TUI changes

## Security & Configuration Tips
Because this repository is public, do not commit secrets, provider credentials, sample tokens, or sensitive test data. Do not merge known security weaknesses or proof-of-concept exploit code into the main codebase. Use environment-backed configuration and follow `SECURITY.md` for reporting sensitive issues privately instead of opening a public exploit report.
