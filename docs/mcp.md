# MCP Setup

This repository uses a split OpenAI/Codex setup: shared defaults in the repo, sensitive or personal MCP servers in the user config.

## Repo-shared config

Keep safe, team-wide defaults in `.codex/config.toml`.

Current repo-shared settings:

- `model = "gpt-5.4"`
- `model_reasoning_effort = "xhigh"`
- `personality = "pragmatic"`
- `chrome-devtools`
- `context7`
- `playwright`
- `memory`
- `sequential-thinking`

These are safe to version because they do not require project secrets in the repo config.

## Personal config

Keep secret-backed or machine-specific MCP servers in `~/.codex/config.toml`.

Recommended examples:

- `postgres` with a real connection string
- any MCP server that needs API tokens, private headers, internal URLs, or local filesystem paths outside the repo

Do not commit database URLs, bearer tokens, private headers, or local-only paths to `.codex/config.toml`.

## Project loading and precedence

Project config is only applied when the repository is trusted by Codex.

Codex resolves config in layers. CLI flags and profiles still have higher precedence, but for the shared file split in this repo the key rule is: `.codex/config.toml` overrides `~/.codex/config.toml` for the same key, while the user config still supplies values that the repo does not define.

Recommended split:

- `.codex/config.toml`: shared defaults and non-secret MCP servers
- `~/.codex/config.toml`: secrets, personal servers, and user-only overrides

## Usage policy

Behavioral rules for when MCP should be used live in `AGENTS.md`.

In this repo:

- use `context7` for library and framework documentation
- use browser MCPs for real UI behavior, rendering, and browser debugging
- use Postgres MCP before assuming schema or live data details
- reserve `memory` and `sequential-thinking` for cases where they add clear value

## Verification

Useful checks:

- `codex mcp list`

`codex mcp list` shows the merged active servers, including personal ones from `~/.codex/config.toml`. Do not paste its raw output into tickets, PRs, or chat if any personal server embeds credentials in `args`.
