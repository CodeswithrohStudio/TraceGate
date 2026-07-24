# TraceGate Product Flow

TraceGate is a release workbench for AI agents. The public site should make the idea immediately legible, then the app should help an engineer run a release gate, inspect trace-backed evidence, and leave with a clear ship or block decision.

## Product Position

This product helps AI platform engineers and agent builders ship safer agents by turning OpenTelemetry and SigNoz evidence into a pre-deploy release gate.

The UI should not compete with SigNoz. It should make SigNoz more accessible by turning traces, metrics, logs, dashboards, alerts, and Noz/MCP investigation into a focused release workflow.

## Primary User Journey

1. Visitor lands on the marketing page and sees a failed agent release with trace-backed evidence.
2. They open the app.
3. First-run setup detects the local SigNoz stack and the default TraceGate contract.
4. They run the default support-agent scenario.
5. The app blocks the release because `tool.trace.lookup` exceeds the retry budget.
6. They open the evidence drawer to see the exact spans and SigNoz investigation prompts.
7. They edit the contract or fix the agent, rerun, and compare before/after evidence.
8. They export the report and SigNoz artifacts for the hackathon demo.

## Public Landing Page

Route: `/`

Goal: make the non-obvious idea obvious in under five seconds.

Hero:

- Headline: "Stop blind agent releases before they ship"
- Subhead: "TraceGate runs agent scenarios, sends telemetry to SigNoz, and blocks releases that are not observable enough to debug."
- Primary CTA: "Open workbench"
- Secondary CTA: "View evidence"
- Visual: one focused release verdict mockup showing `BLOCKED`, the failing check, a trace timeline, and the SigNoz evidence link. This is the desirable result, not a full dashboard.

Sections:

- Workbench proof: a clipped product mockup that shows the latest run, failing contract checks, and the evidence drawer.
- How the gate works: sticky scroll sequence for Contract -> Scenario -> Telemetry -> SigNoz -> Verdict. Each step shows an actual product state.
- Evidence, not vibes: annotated capture explaining why the default release is blocked: parent run span exists, LLM call span exists, tool spans exist, retry budget fails.
- SigNoz expansion: spec-sheet section mapping TraceGate concepts to SigNoz use cases: dashboards, alerts, Query Builder, Noz/MCP investigation, telemetry cost review.
- Verified local facts: stat strip with only real facts from this repo, such as 5 span types observed locally, deterministic demo works without an LLM key, local SigNoz MCP available at port 8000, default candidate intentionally blocked.
- Closing CTA: "Run the gate against the demo agent"

Navigation:

- Wordmark
- Product
- Evidence
- SigNoz
- Docs
- Command/search affordance for builder feel
- Open workbench CTA

Footer:

- Single-line technical footer with repo, docs, and SigNoz links.

## Main App Shell

Route root: `/app`

The main app is a dense operational workbench, not another marketing page.

Global shell:

- Left sidebar: primary navigation, persistent and collapsible.
- Topbar: current project, environment, SigNoz status, Run Gate action, export action.
- Content area: one job per screen.
- Evidence drawer: global right-side drawer that can open from any failed check, span, scenario, or alert.
- Toast/status system: quiet, useful, undo where relevant.

Sidebar:

- Overview
- Runs
- Contracts
- Scenarios
- Evidence
- SigNoz
- Alerts
- Settings

Topbar:

- Breadcrumb
- Project selector: `tracegate-demo-agent`
- Environment selector: Local SigNoz
- SigNoz status pill
- OpenAI key state, hidden value only
- Primary action: Run Gate
- Secondary action: Export Report

## App Pages

### Overview

Route: `/app`

Purpose: answer "Can this agent release ship?"

Main zones:

- Release verdict banner: `Blocked`, `At risk`, or `Ready`.
- Latest run summary: scenario, commit/ref, duration, cost, traces exported, failed checks.
- Gate matrix: required spans, parent-child correlation, retry budget, cost budget, scenario outcome, dashboards/alerts.
- Evidence timeline: scenario steps and correlated spans.
- Next action rail: open failed evidence, rerun, edit contract, open SigNoz.

Empty state:

- If no run exists, show the sample support-agent scenario and a single Run Gate button.

### Runs

Route: `/app/runs`

Purpose: compare release attempts and inspect one run deeply.

Main zones:

- Run table: verdict, scenario, service, timestamp, duration, failed checks, telemetry exported.
- Filters: verdict, scenario, service, date range.
- Split detail panel: selected run timeline, contract results, logs/trace summaries, report actions.
- Compare mode: select two runs to see what changed.

### Run Detail

Route: `/app/runs/:runId`

Purpose: turn a failed release into an investigation path.

Main zones:

- Header: verdict, run ID, scenario, service, duration, cost estimate.
- Scenario timeline: user message, agent decisions, tool calls, retries, final result.
- Contract check matrix: pass/fail/warn rows with evidence links.
- Span waterfall: `agent.run`, `llm.call`, `tool.ticket.lookup`, `tool.policy.search`, `tool.trace.lookup`.
- Evidence drawer: SigNoz query, Noz prompt, related dashboard or alert, copy/export controls.

### Contracts

Route: `/app/contracts`

Purpose: let teams define what "observable enough to ship" means.

Main zones:

- Contract list: default `agent-release.yaml`, variants, last used, last verdict.
- YAML editor: schema-aware, with validation.
- Visual check builder: required spans, max retries, cost budget, correlation rules, dashboards and alerts.
- Dry-run preview: shows which existing runs would pass or fail.

Important interaction:

- Editing a contract does not mutate past reports. It creates a new contract revision.

### Scenarios

Route: `/app/scenarios`

Purpose: design release tests that produce meaningful telemetry.

Main zones:

- Scenario library: default support-agent scenario and future custom scenarios.
- Scenario editor: YAML plus structured step builder.
- Expected outcome panel: success/failure expectations and allowed retries.
- Run selected scenarios action.

### Evidence

Route: `/app/evidence`

Purpose: make SigNoz investigation approachable from a release context.

Main zones:

- Evidence board grouped by failed check.
- Tabs: Traces, Logs, Metrics, Dashboards, Noz Prompts.
- Query chips: service name, span name, trace ID, run ID.
- Copy prompt: focused Noz/MCP questions such as "Why did this release fail its retry budget?"
- Open in SigNoz links.

### SigNoz

Route: `/app/signoz`

Purpose: connect, verify, and explain the SigNoz integration.

Main zones:

- Connection status: UI/API, OTLP HTTP, OTLP gRPC, MCP.
- Local Foundry panel: current ports and patch status.
- Telemetry probe: last exported spans and service name.
- Dashboard and alert artifacts: available YAML/templates and export status.
- Cost/cardinality guidance: labels safe for dimensions versus high-cardinality values.

### Alerts

Route: `/app/alerts`

Purpose: turn release contract failures into reusable SigNoz alert definitions.

Main zones:

- Alert definitions list.
- Severity and condition editor.
- Preview against latest run.
- Export `signoz/alerts.yaml` action.

### Settings

Route: `/app/settings`

Purpose: configure secrets, endpoints, and local behavior without exposing sensitive values.

Main zones:

- LLM provider key status: connected or missing, never displayed.
- SigNoz endpoint settings.
- Report export defaults.
- Cost model settings.
- Team/project metadata for submission.

## First-Run Setup

Shown when `/app` has no completed setup.

Steps:

1. Detect environment: local SigNoz, OTLP endpoints, MCP endpoint.
2. Choose service: default `tracegate-demo-agent`.
3. Choose contract: default `contracts/agent-release.yaml`.
4. Choose scenario: default `scenarios/support-agent.yaml`.
5. Run gate and land on the Run Detail page.

The wizard should be skippable once a run exists.

## Interaction Model

Run Gate:

- Starts from Overview, Runs, Scenarios, or topbar.
- Shows progress states: preparing scenario, running agent, exporting telemetry, evaluating contract, linking evidence.
- On fail, opens the failed check summary and offers Evidence drawer.
- On pass, shows export actions and SigNoz dashboard links.

Evidence Drawer:

- Opens from any failed check or span.
- Contains the smallest useful evidence packet: what failed, trace/span references, query, Noz prompt, related report output.
- Never hides the main page context.

Export:

- Report JSON/Markdown for judges.
- SigNoz dashboard outline.
- Alert YAML.
- Investigation prompts.

## Information Architecture Rules

- The app should lead with verdicts and evidence, not raw telemetry.
- SigNoz remains the system of record for observability data.
- TraceGate is the release-decision layer over SigNoz.
- Every screen must have one primary action.
- Every failure must have a next diagnostic action.
- No invented customer logos, testimonials, or metrics.
- Secrets are never rendered, logged, committed, or echoed.

## MVP Build Order

1. Add `apps/web` with React, Vite, TypeScript, Tailwind, lucide icons, and GSAP.
2. Build route structure: landing page and app shell.
3. Build static product states using real repo demo data and verified local SigNoz facts.
4. Add local JSON/report loading from the CLI output.
5. Add Run Gate integration that invokes the existing CLI.
6. Add SigNoz links, evidence prompts, and export actions.
7. Verify responsive layout, contrast, keyboard focus, and browser behavior.

## Design Acceptance Gates

- Landing hero has one promise, one visual, one primary CTA, and no feature clutter.
- Main app uses persistent sidebar plus contextual topbar.
- All screens have populated, loading, empty, and error states.
- App screen density supports repeated engineering use.
- Color pairings follow `.tastemaker/style-lock.md`.
- UI copy uses real TraceGate concepts from the repo.
- Any metric displayed is either verified from local runs or clearly marked as "to confirm."
