# Verification Log

## 2026-07-24

- `npm install` completed.
- `npm run check` passed.
- `npm run demo -- --no-telemetry` intentionally failed the release gate because `trace.lookup` retried 3 times against a max retry budget of 1.
- `foundryctl v0.2.16` installed from the official SigNoz installer.
- Docker CLI, Docker Compose, Colima, and Lima installed through Homebrew.
- Colima started with Docker runtime.
- `foundryctl gauge -f casting.yaml` passed after Docker setup.
- `foundryctl forge -f casting.yaml` generated `casting.yaml.lock` and local deployment files.
- `foundryctl cast -f casting.yaml` started the SigNoz stack.
- SigNoz UI responds at `http://localhost:8080`.
- TraceGate telemetry exported to local SigNoz via OTLP HTTP at `http://127.0.0.1:4318`.
- ClickHouse verification found spans for `tracegate-demo-agent`: `agent.run`, `llm.call`, `tool.ticket.lookup`, `tool.policy.search`, and `tool.trace.lookup`.

## Local Foundry Patch

The generated local Compose config initially pointed the ingester OpAMP endpoint to `tracegate-signoz-mcp:4320` and the MCP server `SIGNOZ_URL` to itself. The running local deployment was patched to:

- ingester OpAMP: `ws://tracegate-signoz-signoz-0:4320/v1/opamp`
- MCP `SIGNOZ_URL`: `http://tracegate-signoz-signoz-0:8080`

Without this, the collector accepted no useful telemetry because OpAMP replaced the file pipeline with `nop` receivers/exporters.

## Current Expected Demo

The default release candidate is intentionally blocked. This is useful for the hackathon demo because it proves TraceGate is not just producing a pretty report; it can stop an unsafe or undebuggable agent release.
