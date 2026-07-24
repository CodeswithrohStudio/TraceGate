# SigNoz Groundwork

## Installed Local Tooling

The official SigNoz Codex plugin was installed from `SigNoz/agent-skills`:

```sh
codex plugin marketplace add SigNoz/agent-skills
codex plugin add signoz@signoz-skills
```

Installed skill coverage:

- `signoz-mcp-setup`
- `signoz-searching-docs`
- `signoz-generating-queries`
- `signoz-creating-dashboards`
- `signoz-modifying-dashboards`
- `signoz-creating-alerts`
- `signoz-managing-views`
- `signoz-setting-up-observability`
- `signoz-reducing-telemetry-cost`
- `signoz-writing-clickhouse-queries`

## MCP Setup Still Needed

The plugin is installed, but the live MCP endpoint/auth still needs the user's SigNoz target:

```sh
codex mcp login signoz
```

For SigNoz Cloud, provide region or hosted MCP URL. For local/self-hosted, use the HTTP `/mcp` endpoint exposed by the SigNoz MCP server.

## Local Foundry Setup

The repo includes `casting.yaml` for Docker Compose with the SigNoz MCP server enabled:

```sh
foundryctl gauge -f casting.yaml
foundryctl forge -f casting.yaml
foundryctl cast -f casting.yaml
```

## Build Alignment

TraceGate will follow the SigNoz skill guidance:

- discover signal names before querying
- avoid raw HTTP for live SigNoz writes when MCP is available
- build dashboards/alerts only after no-data probes
- use resource filters such as `service.name`
- classify cardinality before turning labels into metric dimensions
- include telemetry cost checks as first-class release gates
