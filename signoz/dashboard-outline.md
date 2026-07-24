# AI Agent Release Overview Dashboard

## Variables

- `service.name`
- `deployment.environment.name`
- `tracegate.scenario.id`

## Panels

1. Release gate status by run
2. Scenario pass/fail count
3. Agent run latency p50/p95/p99
4. LLM calls by scenario
5. LLM token usage by scenario
6. Estimated LLM cost by scenario
7. Tool call count by tool name
8. Tool retry count by tool name
9. Failed spans and example trace IDs
10. Missing contract attributes table

## Drilldowns

- From failed scenario to `agent.run` trace.
- From high retry tool to child `tool.*` spans.
- From high-cost scenario to `llm.call` spans.
