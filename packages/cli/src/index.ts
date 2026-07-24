#!/usr/bin/env node
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import {
  createReport,
  evaluateContract,
  readContract,
  readScenarioSuite,
  type TraceGateReport
} from "@tracegate/core";
import { SupportAgent } from "@tracegate/demo-agent";
import { startTelemetry } from "./telemetry-node.js";

const program = new Command();

program
  .name("tracegate")
  .description("Observability contract release gates for AI agents using SigNoz")
  .version("0.1.0");

program
  .command("run")
  .description("Run a scenario suite and evaluate an observability contract")
  .requiredOption("--scenario <path>", "scenario YAML path")
  .requiredOption("--contract <path>", "contract YAML path")
  .option("--out <path>", "report JSON path", ".tracegate/runs/latest/report.json")
  .option("--no-telemetry", "disable OpenTelemetry export")
  .action(async (options: { scenario: string; contract: string; out: string; telemetry: boolean }) => {
    const telemetry = options.telemetry ? startTelemetry() : undefined;
    const scenarioPath = resolve(options.scenario);
    const contractPath = resolve(options.contract);
    const outPath = resolve(options.out);

    try {
      const [suite, contract] = await Promise.all([
        readScenarioSuite(scenarioPath),
        readContract(contractPath)
      ]);
      const agent = new SupportAgent();
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
          status: containsOk && toolCallsOk && expectedStatusOk ? "pass" as const : "fail" as const
        });
      }

      const checks = evaluateContract(contract, scenarioResults);
      const report = createReport(contract, checks, scenarioResults);
      await writeJson(outPath, report);
      await updateLatestSymlink(outPath);
      printReport(report);
      process.exitCode = report.status === "pass" ? 0 : 1;
    } finally {
      await telemetry?.shutdown();
    }
  });

program
  .command("report")
  .description("Pretty-print a TraceGate report")
  .requiredOption("--input <path>", "report JSON path")
  .action(async (options: { input: string }) => {
    const report = JSON.parse(await readFile(resolve(options.input), "utf8")) as TraceGateReport;
    printReport(report);
  });

program.parseAsync().catch((error: unknown) => {
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});

async function writeJson(path: string, data: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function updateLatestSymlink(reportPath: string) {
  const latestPath = resolve(".tracegate/latest-report.json");
  await mkdir(dirname(latestPath), { recursive: true });
  await rm(latestPath, { force: true });
  await symlink(reportPath, latestPath);
}

function printReport(report: TraceGateReport) {
  const statusColor = report.status === "pass" ? chalk.green : chalk.red;
  console.log(statusColor(`TraceGate ${report.status.toUpperCase()}`));
  console.log(`Contract: ${report.contract.name} v${report.contract.version}`);
  console.log(`Service: ${report.contract.serviceName}`);
  console.log(`Checks: ${report.summary.passed}/${report.summary.totalChecks} passed`);
  console.log(`Critical failures: ${report.summary.criticalFailures}`);
  console.log(`Cost: $${report.summary.totalCostUsd.toFixed(6)}`);
  console.log(`P95 latency: ${report.summary.p95LatencyMs}ms`);
  console.log("");

  for (const check of report.checks) {
    const marker = check.status === "pass" ? chalk.green("PASS") : chalk.red("FAIL");
    console.log(`${marker} ${check.id} (${check.severity}) - ${check.description}`);
    console.log(`     ${check.evidence}`);
  }

  console.log("");
  console.log(chalk.bold("SigNoz next queries"));
  for (const query of report.signoz.suggestedQueries) {
    console.log(`- ${query}`);
  }
}
