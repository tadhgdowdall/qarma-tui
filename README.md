# Qarma TUI

Terminal UI for running Qarma natural language browser tests locally or in the cloud.

This repo is intentionally lightweight. It is an OpenTUI app with a simple landing screen, a minimal workspace shell, and a project structure designed to scale without turning into a monolith.

## Status

Current state:

- initial TUI shell
- landing screen plus workspace view
- OpenTUI-based layout primitives
- architecture scaffold for local and cloud execution

Not implemented yet:

- real QarmaV2 integration
- real local Browser-Use execution
- real provider configuration and secrets management

## Goals

Qarma TUI should eventually support:

- local runs against `localhost`, staging, and private environments
- cloud runs against live public URLs
- Qarma-managed execution
- bring-your-own model access with API keys or local models

## Getting Started

### Requirements

- Bun
- a terminal with decent ANSI support

### Install

```bash
bun install
```

### Run

```bash
bun start
```

### Watch mode

```bash
bun dev
```

Quit with `q`, `Esc`, or `Ctrl+C`.

## Project Structure

See [ARCHITECTURE.md](/Users/tadhgdowdall/qarma-tui/ARCHITECTURE.md) for the intended layout and separation of concerns.

High level:

- `src/tui` for terminal UI
- `src/core` for domain logic and ports
- `src/infra` for external integrations
- `src/shared` for small shared types and helpers

## Contributing

Start with [CONTRIBUTING.md](/Users/tadhgdowdall/qarma-tui/CONTRIBUTING.md).

## Security

Please report sensitive issues using [SECURITY.md](/Users/tadhgdowdall/qarma-tui/SECURITY.md).

## License

MIT. See [LICENSE](/Users/tadhgdowdall/qarma-tui/LICENSE).
