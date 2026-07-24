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
npm run signoz:patch-foundry
foundryctl cast -f casting.yaml
```

Local verification exposed a Foundry-generated Compose issue where the ingester's OpAMP endpoint and MCP `SIGNOZ_URL` pointed at the MCP container instead of the SigNoz app container. The checked-in `casting.yaml.lock` has been adjusted to route OpAMP and API traffic to `tracegate-signoz-signoz-0`.

Current local ports:

- SigNoz UI/API: `http://localhost:8080`
- OTLP HTTP: `http://localhost:4318`
- OTLP gRPC: `localhost:4317`
- SigNoz MCP: `http://localhost:8000/mcp`

## Build Alignment

TraceGate will follow the SigNoz skill guidance:

- discover signal names before querying
- avoid raw HTTP for live SigNoz writes when MCP is available
- build dashboards/alerts only after no-data probes
- use resource filters such as `service.name`
- classify cardinality before turning labels into metric dimensions
- include telemetry cost checks as first-class release gates
