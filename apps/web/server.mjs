import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import dotenv from "dotenv";

const repoRoot = resolve(import.meta.dirname, "../..");
const webRoot = resolve(import.meta.dirname);
const reportPath = resolve(repoRoot, ".tracegate/runs/latest/report.json");
const isDev = process.argv.includes("--dev");
const port = Number(process.env.PORT ?? 5173);

dotenv.config({ path: resolve(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: resolve(repoRoot, ".env"), quiet: true });

const vite = isDev
  ? await import("vite").then(({ createServer: createViteServer }) =>
      createViteServer({
        root: webRoot,
        server: { middlewareMode: true },
        appType: "spa"
      })
    )
  : null;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname === "/api/status" && req.method === "GET") {
      return sendJson(res, await getStatus());
    }
    if (url.pathname === "/api/report" && req.method === "GET") {
      return sendJson(res, await readReportPayload());
    }
    if (url.pathname === "/api/run" && req.method === "POST") {
      const body = await readJson(req);
      return sendJson(res, await runTraceGate(body));
    }
    if (url.pathname === "/api/judge-run" && req.method === "POST") {
      const body = await readJson(req);
      return sendJson(res, await runJudgeGate(body));
    }

    if (vite) {
      vite.middlewares(req, res, (error) => {
        if (error) {
          vite.ssrFixStacktrace(error);
          sendError(res, 500, error);
        } else {
          sendError(res, 404, new Error("Not found"));
        }
      });
      return;
    }

    return serveStatic(req, res);
  } catch (error) {
    return sendError(res, 500, error);
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`TraceGate web ${isDev ? "dev" : "server"} listening on http://localhost:${port}`);
});

async function getStatus() {
  return {
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.TRACEGATE_OPENAI_MODEL ?? "gpt-4.1-mini",
    signoz: {
      ui: "http://localhost:8080",
      otlpHttp: "http://localhost:4318",
      mcp: "http://localhost:8000/mcp"
    },
    reportExists: await exists(reportPath)
  };
}

async function readReportPayload() {
  if (!(await exists(reportPath))) {
    return { report: null, status: await getStatus() };
  }
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  return { report, status: await getStatus() };
}

async function runTraceGate(body) {
  const mode = body?.modelMode === "openai" || body?.modelMode === "deterministic" ? body.modelMode : "auto";
  if (mode === "openai" && !process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      error: "OPENAI_API_KEY is not configured in the local environment.",
      reportPayload: await readReportPayload()
    };
  }

  const args = [
    "tsx",
    "packages/cli/src/index.ts",
    "run",
    "--scenario",
    "scenarios/support-agent.yaml",
    "--contract",
    "contracts/agent-release.yaml",
    "--model-mode",
    mode
  ];
  if (body?.telemetry === false) {
    args.push("--no-telemetry");
  }

  const result = await runCommand("npx", args, {
    ...process.env,
    TRACEGATE_MODEL_MODE: mode
  });
  const reportPayload = await readReportPayload();

  return {
    ok: result.code === 0 || Boolean(reportPayload.report),
    exitCode: result.code,
    stdout: redact(result.stdout),
    stderr: redact(result.stderr),
    reportPayload
  };
}

async function runJudgeGate(body) {
  const input = normalizeJudgeInput(body);
  const report = createJudgeReport(input);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return {
    ok: true,
    reportPayload: await readReportPayload()
  };
}

function normalizeJudgeInput(body) {
  const serviceName = cleanText(body?.serviceName, "judge-agent", 56);
  const scenarioId = slugify(cleanText(body?.scenarioId, "judge-scenario", 48));
  const prompt = cleanText(
    body?.prompt,
    "A customer says the agent is slow. Investigate traces and summarize the issue.",
    360
  );
  const toolName = cleanText(body?.toolName, "trace.lookup", 56);
  const maxToolRetries = clampInt(body?.maxToolRetries, 0, 10, 1);
  const observedRetries = clampInt(body?.observedRetries, 0, 20, 3);
  const maxRunCostUsd = clampNumber(body?.maxRunCostUsd, 0, 1, 0.005);
  const observedCostUsd = clampNumber(body?.observedCostUsd, 0, 1, 0.00012);
  const maxP95LatencyMs = clampInt(body?.maxP95LatencyMs, 1, 60000, 2000);
  const observedLatencyMs = clampInt(body?.observedLatencyMs, 1, 60000, 900);
  return {
    serviceName,
    scenarioId,
    prompt,
    toolName,
    maxToolRetries,
    observedRetries,
    maxRunCostUsd,
    observedCostUsd,
    maxP95LatencyMs,
    observedLatencyMs
  };
}

function createJudgeReport(input) {
  const retryPass = input.observedRetries <= input.maxToolRetries;
  const costPass = input.observedCostUsd <= input.maxRunCostUsd;
  const latencyPass = input.observedLatencyMs <= input.maxP95LatencyMs;
  const scenarioStatus = retryPass && latencyPass ? "pass" : "fail";
  const spans = [
    {
      name: "agent.run",
      attributes: {
        "tracegate.run.source": "judge-input",
        "tracegate.scenario.id": input.scenarioId,
        "service.name": input.serviceName
      }
    },
    {
      name: "llm.call",
      parentName: "agent.run",
      attributes: {
        "gen_ai.system": "judge-supplied",
        "gen_ai.request.model": "judge-agent",
        "tracegate.cost.usd": input.observedCostUsd
      }
    },
    {
      name: `tool.${input.toolName}`,
      parentName: "agent.run",
      attributes: {
        "gen_ai.tool.name": input.toolName,
        "tracegate.tool.kind": "judge-supplied",
        "tracegate.tool.retries": input.observedRetries
      }
    }
  ];
  const checks = [
    check("span-agent-run", "required-span", "Every release run must have a root agent.run span.", "critical", true, "Observed span 'agent.run'."),
    check("span-llm-call", "required-span", "Every release run must expose LLM calls as spans.", "critical", true, "Observed span 'llm.call'."),
    check("attr-llm-model", "required-attribute", "LLM spans must include the model attribute.", "critical", true, "Observed 'gen_ai.request.model' on 'llm.call'."),
    check("attr-llm-cost", "required-attribute", "LLM spans must include estimated cost.", "warning", true, "Observed 'tracegate.cost.usd' on 'llm.call'."),
    check("cost-budget", "max-cost-usd", "The run must stay below the cost budget.", "warning", costPass, `Total run cost $${input.observedCostUsd.toFixed(6)}; limit $${input.maxRunCostUsd}.`),
    check("latency-budget", "max-p95-latency-ms", "The run must stay below the latency budget.", "warning", latencyPass, `Observed latency ${input.observedLatencyMs}ms; limit ${input.maxP95LatencyMs}ms.`),
    check("retry-budget-trace-lookup", "max-tool-retries", "Tool retries must stay within the release budget.", "critical", retryPass, `Worst retry count for '${input.toolName}' was ${input.observedRetries}; limit ${input.maxToolRetries}.`),
    check(`${input.scenarioId}-scenario`, "scenario-must-pass", "Judge supplied scenario must pass the release contract.", "critical", scenarioStatus === "pass", `Scenario '${input.scenarioId}' ended ${scenarioStatus}.`)
  ];
  const failed = checks.filter((item) => item.status === "fail");
  return {
    generatedAt: new Date().toISOString(),
    contract: {
      name: "Judge Supplied Agent Release Contract",
      version: "interactive",
      serviceName: input.serviceName,
      budgets: {
        maxRunCostUsd: input.maxRunCostUsd,
        maxP95LatencyMs: input.maxP95LatencyMs,
        maxToolRetries: input.maxToolRetries
      }
    },
    status: failed.some((item) => item.severity === "critical") ? "fail" : "pass",
    summary: {
      totalChecks: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      criticalFailures: failed.filter((item) => item.severity === "critical").length,
      totalCostUsd: input.observedCostUsd,
      p95LatencyMs: input.observedLatencyMs
    },
    checks,
    scenarios: [
      {
        scenarioId: input.scenarioId,
        prompt: input.prompt,
        status: scenarioStatus,
        output: retryPass
          ? "The agent completed inside the retry contract."
          : `The agent retried ${input.toolName} ${input.observedRetries} times, exceeding the release budget.`,
        toolCalls: [input.toolName],
        retries: { [input.toolName]: input.observedRetries },
        costUsd: input.observedCostUsd,
        latencyMs: input.observedLatencyMs,
        spans
      }
    ],
    signoz: {
      serviceName: input.serviceName,
      suggestedQueries: [
        `service.name = '${input.serviceName}'`,
        `tracegate.scenario.id = '${input.scenarioId}'`,
        `name = 'tool.${input.toolName}'`
      ],
      dashboards: [
        `${input.serviceName} Release Overview`,
        `${input.serviceName} Cost and Latency Budget`,
        `${input.toolName} Retry Loop Watch`
      ],
      alerts: [
        `${input.serviceName} critical release failure`,
        `${input.toolName} retry budget exceeded`,
        `${input.serviceName} latency budget exceeded`
      ]
    }
  };
}

function check(id, type, description, severity, passed, evidence) {
  return {
    id,
    type,
    description,
    severity,
    status: passed ? "pass" : "fail",
    evidence
  };
}

function cleanText(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[^\w\s.:'/-]/g, "").trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "judge-scenario";
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function runCommand(command, args, env) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env,
      shell: false
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => resolveRun({ code, stdout, stderr }));
  });
}

async function serveStatic(req, res) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const distRoot = resolve(webRoot, "dist");
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = resolve(distRoot, `.${requestedPath}`);
  const safePath = filePath.startsWith(distRoot) ? filePath : join(distRoot, "index.html");
  const finalPath = (await exists(safePath)) ? safePath : join(distRoot, "index.html");
  const fileStat = await stat(finalPath);
  res.writeHead(200, {
    "content-type": contentType(finalPath),
    "content-length": fileStat.size
  });
  createReadStream(finalPath).pipe(res);
}

function contentType(path) {
  switch (extname(path)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function readJson(req) {
  return new Promise((resolveRead, rejectRead) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
    });
    req.on("end", () => {
      if (!raw) {
        resolveRead({});
        return;
      }
      try {
        resolveRead(JSON.parse(raw));
      } catch (error) {
        rejectRead(error);
      }
    });
  });
}

function sendJson(res, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, status, error) {
  if (res.headersSent) {
    res.end();
    return;
  }
  const body = JSON.stringify({ error: error instanceof Error ? error.message : String(error) });
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function redact(value) {
  return value.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
}
