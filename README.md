# Qarma TUI

Terminal UI for running Qarma natural language browser tests locally or in the cloud.

This repo is intentionally lightweight. It is an OpenTUI app with a simple landing screen, a minimal workspace shell, and a project structure designed to scale without turning into a monolith.

## Status

Current state:

- initial TUI shell
- landing screen plus workspace view
- OpenTUI-based layout primitives
- architecture scaffold for local and cloud execution
- internal local Browser-Use process bridge for BYO OpenAI or Qarma-managed inference

Not implemented yet:

- real QarmaV2 integration
- polished provider configuration and secrets management UI
- real cloud execution integration

## Goals

Qarma TUI should eventually support:

- local runs against `localhost`, staging, and private environments
- cloud runs against live public URLs
- Qarma-managed execution
- bring-your-own model access with API keys or local models

## Install

### Recommended CLI install

```bash
curl -fsSL https://bun.sh/install | bash
bun add -g qarma-tui
qarma-tui
```

On first launch, Qarma TUI will offer to install its managed local runtime automatically.

You can also run setup explicitly:

```bash
qarma-tui setup
qarma-tui doctor
qarma-tui
```

For one-off use:

```bash
bunx qarma-tui
```

### Development install

For contributors working from source:

```bash
bun install
```

Run from source with:

```bash
bun start
```

Or use watch mode:

```bash
bun dev
```

## Runtime Requirements

- Bun for the published CLI
- a terminal with decent ANSI support
- Python 3 available on the machine for the managed local runtime bootstrap

The standard CLI path no longer expects users to manually run `pip install ...`. `qarma-tui setup` owns the local runtime.

Quit with `Esc` or `Ctrl+C`.

## Local Execution

Local runs are executed on the user's machine. For the BYO OpenAI path, the browser and Browser-Use agent both run locally and call the provider API directly from the local process.

Current local provider inputs:

- `OPENAI_API_KEY` for `openai-local`
- `QARMA_ACCESS_TOKEN` and `QARMA_API_URL` for `qarma-managed`

No secrets are checked into the repo or stored in run state.

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
