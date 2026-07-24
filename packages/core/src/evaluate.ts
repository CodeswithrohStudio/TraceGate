import type { CheckResult } from "./report.js";
import type { ContractCheck, ObservabilityContract, ScenarioResult } from "./schema.js";

export function evaluateContract(
  contract: ObservabilityContract,
  scenarioResults: ScenarioResult[]
): CheckResult[] {
  return contract.checks.map((check) => evaluateCheck(check, scenarioResults));
}

function evaluateCheck(check: ContractCheck, scenarioResults: ScenarioResult[]): CheckResult {
  switch (check.type) {
    case "required-span": {
      const hit = scenarioResults.some((result) =>
        result.spans.some((span) => span.name === check.spanName)
      );
      return result(check, hit, hit ? `Observed span '${check.spanName}'.` : `Missing span '${check.spanName}'.`);
    }
    case "required-attribute": {
      const hit = scenarioResults.some((scenario) =>
        scenario.spans.some((span) => span.name === check.spanName && check.attribute in span.attributes)
      );
      return result(
        check,
        hit,
        hit
          ? `Observed '${check.attribute}' on '${check.spanName}'.`
          : `Missing '${check.attribute}' on '${check.spanName}'.`
      );
    }
    case "max-cost-usd": {
      const total = scenarioResults.reduce((sum, scenario) => sum + scenario.costUsd, 0);
      return result(check, total <= check.maxUsd, `Total run cost $${total.toFixed(6)}; limit $${check.maxUsd}.`);
    }
    case "max-tool-retries": {
      const worst = Math.max(
        0,
        ...scenarioResults.map((scenario) => scenario.retries[check.toolName] ?? 0)
      );
      return result(
        check,
        worst <= check.maxRetries,
        `Worst retry count for '${check.toolName}' was ${worst}; limit ${check.maxRetries}.`
      );
    }
    case "scenario-must-pass": {
      const target = scenarioResults.find((scenario) => scenario.scenarioId === check.scenarioId);
      return result(
        check,
        target?.status === "pass",
        target ? `Scenario '${check.scenarioId}' ended ${target.status}.` : `Scenario '${check.scenarioId}' did not run.`
      );
    }
  }
}

function result(check: ContractCheck, passed: boolean, evidence: string): CheckResult {
  return {
    id: check.id,
    type: check.type,
    description: check.description,
    severity: check.severity,
    status: passed ? "pass" : "fail",
    evidence
  };
}
