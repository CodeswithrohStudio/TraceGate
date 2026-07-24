# SigNoz / Noz Investigation Prompts

Use these after a TraceGate run lands telemetry in SigNoz.

## Release Failure

Why did the latest TraceGate release fail for `service.name = "tracegate-demo-agent"`? Correlate `agent.run`, `llm.call`, and `tool.*` spans from the last 30 minutes. Highlight retry loops, failed scenarios, and estimated cost.

## Tool Retry Loop

Find tool spans where `tracegate.tool.retries > 1` for `tracegate-demo-agent` in the last hour. Group by `gen_ai.tool.name` and show example traces.

## LLM Cost

Show total `tracegate.agent.cost.usd` and `tracegate.agent.tokens` by `tracegate.scenario.id` for the latest release run.

## Observability Gap

Which TraceGate contract-required spans or attributes are missing from `tracegate-demo-agent` telemetry in the last hour?
