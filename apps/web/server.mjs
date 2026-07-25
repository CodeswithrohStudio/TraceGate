import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
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
