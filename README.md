# TraceGate

Observability contracts and CI release gates for AI agent releases, powered by SigNoz and OpenTelemetry.

TraceGate runs realistic agent scenarios, emits traces/logs/metrics into SigNoz, and grades whether the agent is observable enough to ship. It treats observability as a release artifact: LLM calls must be traced, tool calls must correlate to a parent run, cost must stay bounded, failures must be explainable, and dashboards/alerts must exist or be generated.

## Why This Exists

Most AI agent teams discover their observability gaps after production failure. TraceGate moves that discovery before deploy.

```sh
npm install
npm run demo
```

The default demo uses deterministic local model responses, so it can run without an LLM API key. To export telemetry to SigNoz, run SigNoz locally or point `OTEL_EXPORTER_OTLP_ENDPOINT` at a SigNoz-compatible OTLP HTTP collector.

## Hackathon Fit

- Uses SigNoz as the release evidence system, not just a post-incident dashboard.
- Emits OpenTelemetry traces, logs, and metrics for AI agent runs.
- Generates a pass/fail release report with links and queries designed for SigNoz.
- Includes Foundry `casting.yaml` so judges can reproduce a local SigNoz setup.
- Leaves room for Noz/MCP-driven investigation: "why did this release fail?"

## Repo Shape

- `packages/core` - contract schema, evaluator, scenario runner primitives, report model.
- `packages/demo-agent` - intentionally imperfect AI support agent with tool calls and failure modes.
- `packages/cli` - `tracegate` command line interface.
- `contracts` - observability contract definitions.
- `scenarios` - release scenario definitions.
- `signoz` - dashboard, alert, MCP, and query artifacts.
- `docs` - build plan, architecture, and submission notes.

## First Real-World Inputs Needed

Do not paste secrets into chat. The only user-provided values TraceGate eventually needs are:

1. SigNoz target: Cloud region (`us`, `us2`, `eu`, `eu2`, `in`, `in2`) or self-hosted MCP URL.
2. SigNoz service account API key entered through the SigNoz/Codex OAuth flow or local environment.
3. Optional LLM key if we want real model calls instead of deterministic demo mode.
4. Final hackathon team/project metadata for submission copy.

Everything else should be buildable locally.
