import type { ContractCheck, ObservabilityContract, ScenarioResult, Severity } from "./schema.js";

export type CheckResult = {
  id: string;
  type: ContractCheck["type"];
  description: string;
  severity: Severity;
  status: "pass" | "fail";
  evidence: string;
};

export type TraceGateReport = {
  generatedAt: string;
  contract: {
    name: string;
    version: string;
    serviceName: string;
  };
  status: "pass" | "fail";
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    criticalFailures: number;
    totalCostUsd: number;
    p95LatencyMs: number;
  };
  checks: CheckResult[];
  scenarios: ScenarioResult[];
  signoz: {
    serviceName: string;
    suggestedQueries: string[];
    dashboards: string[];
    alerts: string[];
  };
};

export function createReport(
  contract: ObservabilityContract,
  checks: CheckResult[],
  scenarios: ScenarioResult[]
): TraceGateReport {
  const failed = checks.filter((check) => check.status === "fail");
  const latencies = scenarios.map((scenario) => scenario.latencyMs).sort((a, b) => a - b);
  const p95LatencyMs = percentile(latencies, 0.95);

  return {
    generatedAt: new Date().toISOString(),
    contract: {
      name: contract.name,
      version: contract.version,
      serviceName: contract.serviceName
    },
    status: failed.some((check) => check.severity === "critical") ? "fail" : "pass",
    summary: {
      totalChecks: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      criticalFailures: failed.filter((check) => check.severity === "critical").length,
      totalCostUsd: scenarios.reduce((total, scenario) => total + scenario.costUsd, 0),
      p95LatencyMs
    },
    checks,
    scenarios,
    signoz: {
      serviceName: contract.serviceName,
      suggestedQueries: [
        `service.name = '${contract.serviceName}'`,
        `name CONTAINS 'agent.'`,
        `name CONTAINS 'llm.' OR name CONTAINS 'tool.'`
      ],
      dashboards: contract.requiredDashboards,
      alerts: contract.requiredAlerts
    }
  };
}

function percentile(values: number[], rank: number): number {
  if (values.length === 0) {
    return 0;
  }
  const index = Math.min(values.length - 1, Math.ceil(values.length * rank) - 1);
  return values[index] ?? values[values.length - 1] ?? 0;
}
