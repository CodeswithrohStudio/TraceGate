# TraceGate Build Plan

## Product Thesis

TraceGate is an observability contract gate for AI agent releases. It runs scenario tests, sends telemetry to SigNoz, then proves whether the release is observable, debuggable, and cost-bounded enough to ship.

## MVP Milestones

1. Repo foundation
   - TypeScript workspace
   - CLI skeleton
   - contract and scenario schemas
   - deterministic demo agent

2. Telemetry foundation
   - OpenTelemetry SDK bootstrap
   - agent run span
   - LLM call span
   - tool call span
   - structured logs
   - token/cost metrics

3. Contract evaluator
   - checks for required spans
   - checks for parent-child correlation
   - checks max retry/tool-loop behavior
   - checks token/cost budget
   - checks scenario outcomes
   - emits pass/fail report

4. SigNoz evidence layer
   - local Foundry `casting.yaml`
   - dashboard JSON/template
   - alert definitions
   - Query Builder/MCP investigation prompts
   - report references to SigNoz queries

5. Demo polish
   - one-command deterministic demo
   - optional real LLM provider mode
   - README story
   - submission narrative
   - final verification log

## Scope Choices

The first build originally did not depend on a frontend. The product direction is now upgraded: keep the CLI plus SigNoz pipeline as the working core, then add a polished web product layer with a separate landing page and a dense release workbench.

The UI must not be decorative. It should expose the existing release-gate workflow, make SigNoz evidence easier to use, and help judges understand the product in one guided path. The canonical UI architecture is recorded in `docs/PRODUCT_FLOW.md`, and the visual contract is recorded in `.tastemaker/style-lock.md`.

## Needed From Rohit

Required later:

- SigNoz Cloud region or self-hosted MCP URL.
- SigNoz auth through Codex MCP login or a local `SIGNOZ_API_KEY`.

Optional:

- `OPENAI_API_KEY` or another LLM provider key for real agent calls.
- Preferred project/team name for the final submission.
- Any sponsor/channel-specific judging detail not visible on the public page.

## Autonomy Rules

Until credentials are available, build all logic against local deterministic mode and mock SigNoz write adapters. The repo should still run, test, and produce useful artifacts without external accounts.
