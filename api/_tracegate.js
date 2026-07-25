import { resolve } from "node:path";
import {
  createReport,
  evaluateContract,
  readContract,
  readScenarioSuite
} from "@tracegate/core";
import { SupportAgent } from "@tracegate/demo-agent";

const repoRoot = resolve(process.cwd());

export async function status() {
  return {
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.TRACEGATE_OPENAI_MODEL ?? "gpt-4.1-mini",
    reportExists: false,
    signoz: {
      ui: process.env.SIGNOZ_UI_URL ?? "http://localhost:8080",
      otlpHttp: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318",
      mcp: process.env.SIGNOZ_MCP_URL ?? "http://localhost:8000/mcp"
    }
  };
}

export async function reportPayload() {
  return {
    report: null,
    status: await status()
  };
}

export async function runGate(body = {}) {
  const mode = body.modelMode === "openai" || body.modelMode === "deterministic" ? body.modelMode : "auto";
  if (mode === "openai" && !process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      error: "OPENAI_API_KEY is not configured for this deployment.",
      reportPayload: await reportPayload()
    };
  }

  const [suite, contract] = await Promise.all([
    readScenarioSuite(resolve(repoRoot, "scenarios/support-agent.yaml")),
    readContract(resolve(repoRoot, "contracts/agent-release.yaml"))
  ]);
  const agent = new SupportAgent({ modelMode: mode });
  const scenarioResults = [];

  for (const step of suite.steps) {
    const result = await agent.run({ scenarioId: step.id, prompt: step.prompt });
    const expectedContains = step.expect.contains;
    const expectedToolCalls = step.expect.toolCalls ?? [];
    const containsOk = expectedContains ? result.output.includes(expectedContains) : true;
    const toolCallsOk = expectedToolCalls.every((tool) => result.toolCalls.includes(tool));
    const expectedStatusOk = result.status === step.expect.status;

    scenarioResults.push({
      ...result,
      status: containsOk && toolCallsOk && expectedStatusOk ? "pass" : "fail"
    });
  }

  const checks = evaluateContract(contract, scenarioResults);
  const report = createReport(contract, checks, scenarioResults);

  return {
    ok: true,
    exitCode: report.status === "pass" ? 0 : 1,
    stdout: `TraceGate ${report.status.toUpperCase()}`,
    stderr: "",
    reportPayload: {
      report,
      status: await status()
    }
  };
}

export function sendJson(response, payload, statusCode = 200) {
  response.status(statusCode).json(payload);
}
