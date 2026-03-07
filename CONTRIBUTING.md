# Contributing

Keep changes small, focused, and easy to review.

## Setup

```bash
bun install
bun dev
```

## Guidelines

- follow the layout described in [ARCHITECTURE.md](/Users/tadhgdowdall/qarma-tui/ARCHITECTURE.md)
- keep `src/tui` free of raw API logic
- keep `src/core` free of terminal rendering concerns
- put external integrations in `src/infra`
- avoid large refactors unless they unlock a clear next step

## Pull Requests

Before opening a PR:

- make sure the app still starts with `bun start`
- keep naming and file placement consistent with the existing structure
- explain the user-facing change and any tradeoffs

## Scope

This project is still early. Prefer:

- simple UI improvements
- architecture improvements with low churn
- testability improvements
- QarmaV2 integration work that preserves separation of concerns
