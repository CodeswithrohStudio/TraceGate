import { describe, expect, it } from "vitest";
import { evaluateContract } from "./evaluate.js";
import type { ObservabilityContract, ScenarioResult } from "./schema.js";

const contract: ObservabilityContract = {
  name: "test contract",
  version: "0.0.0",
  serviceName: "agent",
  slo: { target: 0.99, window: "30d" },
  budgets: {
    maxRunCostUsd: 0.01,
    maxP95LatencyMs: 2000,
    maxToolRetries: 1
  },
  requiredDashboards: [],
  requiredAlerts: [],
  checks: [
    {
      id: "root-span",
      type: "required-span",
      description: "root span exists",
      spanName: "agent.run",
      severity: "critical"
    },
    {
      id: "retry-budget",
      type: "max-tool-retries",
      description: "retry budget holds",
      toolName: "trace.lookup",
      maxRetries: 1,
      severity: "critical"
    }
  ]
};

const scenario: ScenarioResult = {
  scenarioId: "slow-path",
  prompt: "slow request",
  status: "pass",
  output: "done",
  toolCalls: ["trace.lookup"],
  retries: {
    "trace.lookup": 3
  },
  costUsd: 0.001,
  latencyMs: 100,
  spans: [
    {
      name: "agent.run",
      attributes: {
        "tracegate.run.id": "run_1"
      }
    }
  ]
};

describe("evaluateContract", () => {
  it("fails a critical retry-budget check when a tool loops", () => {
    const results = evaluateContract(contract, [scenario]);

    expect(results).toEqual([
      expect.objectContaining({ id: "root-span", status: "pass" }),
      expect.objectContaining({ id: "retry-budget", status: "fail" })
    ]);
  });
});
