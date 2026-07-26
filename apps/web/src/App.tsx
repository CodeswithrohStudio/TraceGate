import { useEffect, useState } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Clipboard,
  Command,
  ExternalLink,
  Eye,
  FileDown,
  KeyRound,
  Menu,
  Play,
  Search,
  ShieldAlert,
  Sparkles,
  X
} from "lucide-react";
import BoomerangVideoBg from "./BoomerangVideoBg";
import {
  defaultView,
  navItems,
  signozEndpoints,
  viewFromReport
} from "./data";
import type { GateCheck, RuntimeStatus, Scenario, TraceGateReport, TraceGateView } from "./data";

type RunState = "idle" | "preparing" | "telemetry" | "evaluating" | "blocked";
type JudgeRunInput = {
  serviceName: string;
  scenarioId: string;
  prompt: string;
  toolName: string;
  maxToolRetries: number;
  observedRetries: number;
  maxRunCostUsd: number;
  observedCostUsd: number;
  maxP95LatencyMs: number;
  observedLatencyMs: number;
};

const appPaths = new Set(navItems.map((item) => item.path));
const LANDING_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_131941_d136af49-e243-493a-be14-6ff3f24e09e6.mp4";
gsap.registerPlugin(ScrollTrigger);

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [view, setView] = useState<TraceGateView>(defaultView);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<GateCheck>(
    defaultView.gateChecks.find((check) => check.status === "fail") ?? defaultView.gateChecks[0]
  );
  const [judgeInput, setJudgeInput] = useState<JudgeRunInput>({
    serviceName: "judge-support-agent",
    scenarioId: "checkout-latency",
    prompt: "A checkout agent is slow during refunds. Investigate traces and summarize the issue.",
    toolName: "trace.lookup",
    maxToolRetries: 1,
    observedRetries: 3,
    maxRunCostUsd: 0.005,
    observedCostUsd: 0.00012,
    maxP95LatencyMs: 2000,
    observedLatencyMs: 3318
  });
  const [runState, setRunState] = useState<RunState>("idle");
  const [setupOpen, setSetupOpen] = useState(false);

  useEffect(() => {
    void loadReport().then((nextView) => {
      setView(nextView);
      setSelectedCheck(nextView.gateChecks.find((check) => check.status === "fail") ?? nextView.gateChecks[0]);
    });
  }, []);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      return;
    }
    const ctx = gsap.context(() => {
      const heroTimeline = gsap.timeline();
      heroTimeline
        .from("[data-hero-title]", {
          y: 14,
          opacity: 0,
          duration: 0.28,
          ease: "power2.out"
        })
        .from(".film-hero-copy p", {
          y: 10,
          opacity: 0,
          duration: 0.22,
          ease: "power2.out"
        }, "-=0.08")
        .from(".film-bottom-card, .film-play-link", {
          y: 16,
          opacity: 0,
          duration: 0.28,
          ease: "power2.out"
        }, "-=0.12");

      gsap.from("[data-reveal]", {
        y: 12,
        opacity: 0,
        duration: 0.24,
        ease: "power2.out",
        stagger: 0.04,
        scrollTrigger: {
          trigger: "[data-reveal]",
          start: "top 88%",
          toggleActions: "play none none reverse"
        }
      });

      gsap.from("[data-story-step]", {
        x: -18,
        duration: 0.24,
        ease: "power2.out",
        stagger: 0.08,
        scrollTrigger: {
          trigger: ".story-steps",
          start: "top 82%",
          toggleActions: "play none none reverse"
        }
      });
    }, document.body);
    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, [path]);

  const navigate = (nextPath: string) => {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const openEvidence = (check: GateCheck = selectedCheck) => {
    setSelectedCheck(check);
    setEvidenceOpen(true);
  };

  const runGate = async () => {
    setRunState("preparing");
    await wait(240);
    setRunState("telemetry");
    await wait(240);
    setRunState("evaluating");
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modelMode: view.status?.hasOpenAIKey ? "auto" : "deterministic" })
    });
    const payload = (await response.json()) as RunPayload;
    const nextView = viewFromReport(payload.reportPayload?.report ?? null, payload.reportPayload?.status);
    setView(nextView);
    const failedCheck = nextView.gateChecks.find((check) => check.status === "fail") ?? nextView.gateChecks[0];
    setSelectedCheck(failedCheck);
    setRunState(nextView.reportSummary.status === "pass" ? "idle" : "blocked");
    openEvidence(failedCheck);
  };

  const runJudgeGate = async () => {
    setRunState("preparing");
    await wait(180);
    setRunState("telemetry");
    await wait(180);
    setRunState("evaluating");
    let nextView: TraceGateView;
    try {
      const response = await fetch("/api/judge-run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(judgeInput)
      });
      if (!response.ok) {
        throw new Error(`Judge run API returned ${response.status}`);
      }
      const payload = (await response.json()) as RunPayload;
      nextView = viewFromReport(payload.reportPayload?.report ?? null, payload.reportPayload?.status);
    } catch {
      nextView = viewFromReport(createClientJudgeReport(judgeInput), view.status);
    }
    setView(nextView);
    const failedCheck = nextView.gateChecks.find((check) => check.status === "fail") ?? nextView.gateChecks[0];
    setSelectedCheck(failedCheck);
    setRunState(nextView.reportSummary.status === "pass" ? "idle" : "blocked");
    openEvidence(failedCheck);
  };

  const showApp = path === "/app" || path.startsWith("/app/");

  if (!showApp) {
    return <LandingPage view={view} navigate={navigate} openEvidence={() => navigate("/app/evidence")} />;
  }

  return (
    <AppShell
      path={appPaths.has(path) ? path : "/app"}
      navigate={navigate}
      runGate={runGate}
      runJudgeGate={runJudgeGate}
      runState={runState}
      judgeInput={judgeInput}
      setJudgeInput={setJudgeInput}
      evidenceOpen={evidenceOpen}
      setEvidenceOpen={setEvidenceOpen}
      selectedCheck={selectedCheck}
      openEvidence={openEvidence}
      setupOpen={setupOpen}
      setSetupOpen={setSetupOpen}
      view={view}
    />
  );
}

type ReportPayload = {
  report: TraceGateReport | null;
  status?: RuntimeStatus;
};

type RunPayload = {
  ok: boolean;
  error?: string;
  reportPayload?: ReportPayload;
};

async function loadReport(): Promise<TraceGateView> {
  const response = await fetch("/api/report");
  const payload = (await response.json()) as ReportPayload;
  return viewFromReport(payload.report, payload.status);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createClientJudgeReport(input: JudgeRunInput): TraceGateReport {
  const scenarioId = slugify(input.scenarioId || "judge-scenario");
  const serviceName = cleanClientText(input.serviceName, "judge-agent");
  const toolName = cleanClientText(input.toolName, "trace.lookup");
  const prompt = cleanClientText(input.prompt, "Judge supplied scenario");
  const maxToolRetries = clampClientInt(input.maxToolRetries, 0, 10);
  const observedRetries = clampClientInt(input.observedRetries, 0, 20);
  const maxRunCostUsd = clampClientNumber(input.maxRunCostUsd, 0, 1);
  const observedCostUsd = clampClientNumber(input.observedCostUsd, 0, 1);
  const maxP95LatencyMs = clampClientInt(input.maxP95LatencyMs, 1, 60000);
  const observedLatencyMs = clampClientInt(input.observedLatencyMs, 1, 60000);
  const retryPass = observedRetries <= maxToolRetries;
  const costPass = observedCostUsd <= maxRunCostUsd;
  const latencyPass = observedLatencyMs <= maxP95LatencyMs;
  const scenarioStatus = retryPass && latencyPass ? "pass" : "fail";
  const checks = [
    clientCheck("span-agent-run", "required-span", "Every release run must have a root agent.run span.", "critical", true, "Observed span 'agent.run'."),
    clientCheck("span-llm-call", "required-span", "Every release run must expose LLM calls as spans.", "critical", true, "Observed span 'llm.call'."),
    clientCheck("attr-llm-model", "required-attribute", "LLM spans must include the model attribute.", "critical", true, "Observed 'gen_ai.request.model' on 'llm.call'."),
    clientCheck("attr-llm-cost", "required-attribute", "LLM spans must include estimated cost.", "warning", true, "Observed 'tracegate.cost.usd' on 'llm.call'."),
    clientCheck("cost-budget", "max-cost-usd", "The run must stay below the cost budget.", "warning", costPass, `Total run cost $${observedCostUsd.toFixed(6)}; limit $${maxRunCostUsd}.`),
    clientCheck("latency-budget", "max-p95-latency-ms", "The run must stay below the latency budget.", "warning", latencyPass, `Observed latency ${observedLatencyMs}ms; limit ${maxP95LatencyMs}ms.`),
    clientCheck("retry-budget-trace-lookup", "max-tool-retries", "Tool retries must stay within the release budget.", "critical", retryPass, `Worst retry count for '${toolName}' was ${observedRetries}; limit ${maxToolRetries}.`),
    clientCheck(`${scenarioId}-scenario`, "scenario-must-pass", "Judge supplied scenario must pass the release contract.", "critical", scenarioStatus === "pass", `Scenario '${scenarioId}' ended ${scenarioStatus}.`)
  ];
  const failed = checks.filter((check) => check.status === "fail");
  return {
    generatedAt: new Date().toISOString(),
    contract: {
      name: "Judge Supplied Agent Release Contract",
      version: "interactive",
      serviceName,
      budgets: {
        maxRunCostUsd,
        maxP95LatencyMs,
        maxToolRetries
      }
    },
    status: failed.some((check) => check.severity === "critical") ? "fail" : "pass",
    summary: {
      totalChecks: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      criticalFailures: failed.filter((check) => check.severity === "critical").length,
      totalCostUsd: observedCostUsd,
      p95LatencyMs: observedLatencyMs
    },
    checks,
    scenarios: [
      {
        scenarioId,
        prompt,
        status: scenarioStatus,
        toolCalls: [toolName],
        retries: { [toolName]: observedRetries },
        costUsd: observedCostUsd,
        latencyMs: observedLatencyMs,
        spans: [
          { name: "agent.run" },
          { name: "llm.call" },
          { name: `tool.${toolName}` }
        ]
      }
    ],
    signoz: {
      serviceName,
      suggestedQueries: [
        `service.name = '${serviceName}'`,
        `tracegate.scenario.id = '${scenarioId}'`,
        `name = 'tool.${toolName}'`
      ],
      dashboards: [
        `${serviceName} Release Overview`,
        `${serviceName} Cost and Latency Budget`,
        `${toolName} Retry Loop Watch`
      ],
      alerts: [
        `${serviceName} critical release failure`,
        `${toolName} retry budget exceeded`,
        `${serviceName} latency budget exceeded`
      ]
    }
  };
}

function clientCheck(
  id: string,
  type: string,
  description: string,
  severity: "critical" | "warning",
  passed: boolean,
  evidence: string
) {
  return {
    id,
    type,
    description,
    severity,
    status: passed ? "pass" as const : "fail" as const,
    evidence
  };
}

function cleanClientText(value: string, fallback: string): string {
  const cleaned = value.replace(/[^\w\s.:'/-]/g, "").trim();
  return cleaned || fallback;
}

function slugify(value: string): string {
  return cleanClientText(value, "judge-scenario")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "judge-scenario";
}

function clampClientInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)));
}

function clampClientNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function LandingPage({
  view,
  navigate,
  openEvidence
}: {
  view: TraceGateView;
  navigate: (path: string) => void;
  openEvidence: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const failedCheck = view.gateChecks.find((check) => check.status === "fail") ?? view.gateChecks[0];
  const navLinks = [
    ["#narrative", "Product"],
    ["#evidence", "Evidence"],
    ["#signoz", "SigNoz"],
    ["/docs/PRODUCT_FLOW.md", "Docs"]
  ] as const;
  const signozCards = [
    ["Dashboards", "Release overview, LLM cost, tool retry loops", Activity],
    ["Alerts", "Failure rate, retry loops, cost budget", AlertTriangle],
    ["Noz prompts", "Why did this release fail its retry budget?", Search],
    ["MCP", "Local endpoint at http://localhost:8000/mcp", Command]
  ] as const;
  const storySteps = [
    ["01", "Run the risky path", "Refund, latency, and prompt-injection scenarios exercise behavior before release."],
    ["02", "Capture the trace", "Model, tool, retry, cost, and latency spans land as OpenTelemetry evidence."],
    ["03", "Check the contract", "TraceGate compares the observed run against budgets that define observable enough."],
    ["04", "Block or ship", "The failed span becomes a verdict, not a vague dashboard note."]
  ] as const;

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <main className="immersive-landing">
      <section className="landing-film">
        <BoomerangVideoBg src={LANDING_VIDEO} />
        <div className="film-wash" />

        <nav className="film-nav" data-reveal>
          <Brand />
          <div className="film-nav-pill" aria-label="Primary">
            {navLinks.map(([href, label], index) => (
              <a className={index === 0 ? "active" : ""} href={href} key={href}>
                {label}
              </a>
            ))}
            <button type="button" onClick={() => navigate("/app")}>
              Open workbench
            </button>
          </div>
          <div className="film-nav-actions">
            <button className="film-text-link" type="button" onClick={openEvidence}>
              <Eye size={15} />
              Evidence
            </button>
            <button className="film-text-link" type="button" onClick={() => navigate("/app")}>
              <Command size={15} />
              Run gate
            </button>
            <button
              className="film-menu"
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              <Menu className={menuOpen ? "hide" : "show"} size={20} />
              <X className={menuOpen ? "show" : "hide"} size={20} />
            </button>
          </div>
        </nav>

        <div className={menuOpen ? "mobile-film-scrim open" : "mobile-film-scrim"} onClick={() => setMenuOpen(false)} />
        <aside className={menuOpen ? "mobile-film-drawer open" : "mobile-film-drawer"} aria-hidden={!menuOpen}>
          {navLinks.map(([href, label], index) => (
            <a
              href={href}
              key={href}
              onClick={() => setMenuOpen(false)}
              style={{ transitionDelay: menuOpen ? `${120 + index * 70}ms` : "0ms" }}
            >
              {label}
            </a>
          ))}
          <button type="button" onClick={() => navigate("/app")}>
            Open workbench
          </button>
        </aside>

        <div className="film-hero-copy">
          <h1 data-hero-title>
            Ship agents only when the <span>traces agree</span>.
          </h1>
          <p>
            TraceGate turns SigNoz telemetry into a release gate: run risky scenarios,
            inspect the spans, and block fragile agent behavior before deploy.
          </p>
        </div>

        <div className="film-bottom-card">
          <div>
            <Sparkles size={16} />
            <span>TraceGate release gate</span>
          </div>
          <p>{failedCheck.evidence}</p>
          <div className="film-bottom-actions">
            <button type="button" onClick={() => navigate("/app")}>
              Open workbench
            </button>
            <button type="button" onClick={openEvidence}>
              View evidence.
            </button>
          </div>
        </div>

        <button className="film-play-link" type="button" onClick={() => navigate("/app")}>
          <span><Play size={12} fill="currentColor" /></span>
          Watch the gate run
          <small>0:42</small>
        </button>
      </section>

      <div className="site-shell film-proof-shell">
        <section className="stakes-section" id="narrative" data-reveal>
          <div className="section-copy">
            <p className="eyebrow">The risk</p>
            <h2>Agent releases fail in the gap between a passing demo and a trustworthy trace.</h2>
            <p>Without a release gate, teams discover tool loops, hidden cost, and unsafe retries after users have already touched the agent.</p>
          </div>
          <div className="stakes-visual">
            <article>
              <span>Without TraceGate</span>
              <strong>Demo passes</strong>
              <p>Retries and tool behavior stay buried until someone opens SigNoz after the incident.</p>
            </article>
            <ArrowRight size={18} />
            <article>
              <span>With TraceGate</span>
              <strong>Trace decides</strong>
              <p>The same SigNoz evidence becomes a release control before deploy.</p>
            </article>
          </div>
        </section>

        <section className="mechanism-section" data-reveal>
          <div className="section-copy">
            <p className="eyebrow">The mechanism</p>
            <h2>TraceGate turns observability into a contract.</h2>
            <p>The product does not ask reviewers to interpret raw telemetry. It packages a failed span, the exact budget, and the Noz prompt into one reviewable packet.</p>
          </div>
          <div className="evidence-frame">
            <div className="frame-caption">
              <span>Evidence packet</span>
              <strong>Critical span isolated</strong>
            </div>
            <EvidenceCapture view={view} />
          </div>
        </section>

        <section className="story-section" data-reveal>
          <div className="section-copy sticky-copy" data-reveal>
            <p className="eyebrow">How it works</p>
            <h2>Four steps turn a messy agent run into a release verdict.</h2>
            <p>Each step maps to something judges can inspect: a scenario, a trace, a contract, and the final blocked decision.</p>
          </div>
          <div className="story-steps">
            {storySteps.map(([step, title, copy]) => (
              <article className="story-step" data-story-step key={title}>
                <span>{step}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="workbench-band proof-section" data-reveal>
          <div className="section-copy">
            <p className="eyebrow">The proof</p>
            <h2>The workbench answers one release question: can this agent ship?</h2>
            <p>Here the story becomes concrete: seven checks pass, one retry-budget contract fails, and the evidence drawer knows exactly which span proves it.</p>
          </div>
          <div className="proof-stage">
            <MiniDashboard view={view} openApp={() => navigate("/app")} />
            <div className="proof-note">
              <span>{view.reportSummary.passed}/{view.reportSummary.totalChecks} checks pass</span>
              <strong>1 blocking trace contract</strong>
            </div>
          </div>
        </section>

        <section className="evidence-band" id="evidence" data-reveal>
          <div className="section-copy">
            <p className="eyebrow">Evidence packet</p>
            <h2>A blocked release should come with a reason people can verify.</h2>
            <p>The failed check points to the exact span, the exceeded budget, and the investigation prompt for SigNoz.</p>
          </div>
          <div className="evidence-ledger">
            <div className="ledger-row">
              <span>Failed check</span>
              <strong>{failedCheck.label}</strong>
            </div>
            <div className="ledger-row">
              <span>Span proof</span>
              <strong>tool.trace.lookup · retries = 3</strong>
            </div>
            <div className="ledger-row">
              <span>Budget</span>
              <strong>max retries = {view.reportSummary.maxToolRetries}</strong>
            </div>
          </div>
        </section>

        <section className="spec-section" id="signoz" data-reveal>
          <div className="section-copy">
            <p className="eyebrow">SigNoz expansion</p>
            <h2>SigNoz becomes the shared review surface for agent quality.</h2>
            <p>TraceGate expands SigNoz from incident investigation into pre-release governance for AI agents.</p>
          </div>
          <div className="spec-table spec-grid">
            {signozCards.map(([label, value, Icon]) => (
              <div className="spec-row" key={label}>
                <Icon size={18} />
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="closing-cta" data-reveal>
          <h2>Find the fragile agent before production does.</h2>
          <button className="btn btn-primary" type="button" onClick={() => navigate("/app")}>
            Enter TraceGate <ArrowRight size={16} />
          </button>
        </section>

        <footer className="site-footer">
          <Brand />
          <span>OpenTelemetry contracts for SigNoz-backed AI agent releases.</span>
        </footer>
      </div>
    </main>
  );
}

function AppShell({
  path,
  navigate,
  runGate,
  runJudgeGate,
  runState,
  judgeInput,
  setJudgeInput,
  evidenceOpen,
  setEvidenceOpen,
  selectedCheck,
  openEvidence,
  setupOpen,
  setSetupOpen,
  view
}: {
  path: string;
  navigate: (path: string) => void;
  runGate: () => Promise<void>;
  runJudgeGate: () => Promise<void>;
  runState: RunState;
  judgeInput: JudgeRunInput;
  setJudgeInput: Dispatch<SetStateAction<JudgeRunInput>>;
  evidenceOpen: boolean;
  setEvidenceOpen: (open: boolean) => void;
  selectedCheck: GateCheck;
  openEvidence: (check?: GateCheck) => void;
  setupOpen: boolean;
  setSetupOpen: (open: boolean) => void;
  view: TraceGateView;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand-button" type="button" onClick={() => navigate("/")}>
          <Brand />
        </button>
        <nav className="side-nav" aria-label="TraceGate app">
          {navItems.map((item) => {
            const active = path === item.path;
            return (
              <button
                className={active ? "side-link active" : "side-link"}
                type="button"
                key={item.path}
                onClick={() => navigate(item.path)}
              >
                <item.icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-status">
          <span className="status-dot" />
          <div>
            <strong>Local SigNoz</strong>
            <span>localhost:8080</span>
          </div>
        </div>
      </aside>

      <section className="app-main">
        <header className="topbar">
          <div className="crumbs">
            <span>TraceGate</span>
            <ChevronRight size={14} />
            <strong>{navItems.find((item) => item.path === path)?.label ?? "Overview"}</strong>
          </div>
          <div className="topbar-actions">
            <button className="status-chip" type="button" onClick={() => setSetupOpen(true)}>
              <span className="status-dot" />
              {view.status?.hasOpenAIKey ? "OpenAI ready" : "Deterministic mode"}
            </button>
            <button className="btn btn-secondary compact" type="button">
              <FileDown size={15} />
              Export
            </button>
            <button className="btn btn-primary compact" type="button" onClick={runGate}>
              <Play size={15} />
              {runState === "idle" || runState === "blocked" ? "Run Gate" : "Running"}
            </button>
          </div>
        </header>

        <div className="content-area" data-reveal>
          <RunProgress runState={runState} />
          <CurrentPage
            path={path}
            openEvidence={openEvidence}
            navigate={navigate}
            view={view}
            judgeInput={judgeInput}
            setJudgeInput={setJudgeInput}
            runJudgeGate={runJudgeGate}
            runState={runState}
          />
        </div>
      </section>

      <EvidenceDrawer
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        check={selectedCheck}
        view={view}
      />
      {setupOpen ? <SetupModal view={view} onClose={() => setSetupOpen(false)} /> : null}
    </div>
  );
}

function CurrentPage({
  path,
  openEvidence,
  navigate,
  view,
  judgeInput,
  setJudgeInput,
  runJudgeGate,
  runState
}: {
  path: string;
  openEvidence: (check?: GateCheck) => void;
  navigate: (path: string) => void;
  view: TraceGateView;
  judgeInput: JudgeRunInput;
  setJudgeInput: Dispatch<SetStateAction<JudgeRunInput>>;
  runJudgeGate: () => Promise<void>;
  runState: RunState;
}) {
  if (path === "/app/runs") return <RunsPage view={view} openEvidence={openEvidence} />;
  if (path === "/app/contracts") return <ContractsPage view={view} />;
  if (path === "/app/scenarios") {
    return (
      <ScenariosPage
        view={view}
        judgeInput={judgeInput}
        setJudgeInput={setJudgeInput}
        runJudgeGate={runJudgeGate}
        runState={runState}
      />
    );
  }
  if (path === "/app/evidence") return <EvidencePage view={view} openEvidence={openEvidence} />;
  if (path === "/app/signoz") return <SignozPage view={view} />;
  if (path === "/app/alerts") return <AlertsPage view={view} />;
  if (path === "/app/settings") return <SettingsPage view={view} />;
  return (
    <OverviewPage
      view={view}
      openEvidence={openEvidence}
      navigate={navigate}
      judgeInput={judgeInput}
      setJudgeInput={setJudgeInput}
      runJudgeGate={runJudgeGate}
      runState={runState}
    />
  );
}

function OverviewPage({
  view,
  openEvidence,
  navigate,
  judgeInput,
  setJudgeInput,
  runJudgeGate,
  runState
}: {
  view: TraceGateView;
  openEvidence: (check?: GateCheck) => void;
  navigate: (path: string) => void;
  judgeInput: JudgeRunInput;
  setJudgeInput: Dispatch<SetStateAction<JudgeRunInput>>;
  runJudgeGate: () => Promise<void>;
  runState: RunState;
}) {
  const failed = view.gateChecks.find((check) => check.status === "fail");
  const isBlocked = view.reportSummary.status === "fail";
  return (
    <div className="page-grid overview-grid">
      <section className="verdict-panel release-summary">
        <div className="verdict-copy">
          <p className="eyebrow">Latest release verdict</p>
          <h1>{isBlocked ? "Blocked by trace evidence" : "Ready with trace evidence"}</h1>
          <div className="verdict-scoreline">
            <span>{view.reportSummary.passed}/{view.reportSummary.totalChecks} checks passed</span>
            <span>{view.reportSummary.criticalFailures} critical failure</span>
            <span>{view.reportSummary.serviceName}</span>
          </div>
          <p>{failed?.evidence ?? "All contract checks have attached trace evidence."}</p>
        </div>
        <div className="verdict-badge">
          <ShieldAlert size={22} />
          {isBlocked ? "BLOCKED" : "READY"}
        </div>
      </section>

      <MetricRow view={view} />

      <JudgeRunPanel
        judgeInput={judgeInput}
        setJudgeInput={setJudgeInput}
        runJudgeGate={runJudgeGate}
        runState={runState}
      />

      <section className="panel wide gate-panel">
        <PanelHeader title="Gate matrix" action="Open failed evidence" onAction={() => failed && openEvidence(failed)} />
        <div className="check-list">
          {view.gateChecks.map((check) => (
            <button
              className={check.status === "fail" ? "check-row failed" : "check-row"}
              type="button"
              key={check.id}
              onClick={() => openEvidence(check)}
            >
              <StatusIcon status={check.status} />
              <div>
                <strong>{check.label}</strong>
                <span>{check.evidence}</span>
              </div>
              <code>{check.type}</code>
            </button>
          ))}
        </div>
      </section>

      <section className="panel action-panel">
        <PanelHeader title="Next actions" />
        <div className="action-stack">
          <button className="action-row" type="button" onClick={() => failed && openEvidence(failed)}>
            <Search size={16} />
            Investigate retry loop
          </button>
          <button className="action-row" type="button" onClick={() => navigate("/app/contracts")}>
            <FileDown size={16} />
            Review contract budget
          </button>
          <button className="action-row" type="button" onClick={() => navigate("/app/signoz")}>
            <ExternalLink size={16} />
            Open SigNoz bridge
          </button>
        </div>
      </section>
    </div>
  );
}

function JudgeRunPanel({
  judgeInput,
  setJudgeInput,
  runJudgeGate,
  runState
}: {
  judgeInput: JudgeRunInput;
  setJudgeInput: Dispatch<SetStateAction<JudgeRunInput>>;
  runJudgeGate: () => Promise<void>;
  runState: RunState;
}) {
  const running = runState === "preparing" || runState === "telemetry" || runState === "evaluating";
  const updateText = (key: keyof JudgeRunInput) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setJudgeInput((current) => ({ ...current, [key]: event.target.value }));
  };
  const updateNumber = (key: keyof JudgeRunInput) => (event: ChangeEvent<HTMLInputElement>) => {
    setJudgeInput((current) => ({ ...current, [key]: Number(event.target.value) }));
  };

  return (
    <section className="panel wide judge-panel">
      <div className="judge-panel-head">
        <div>
          <p className="eyebrow">Judge test mode</p>
          <h2>Run your own agent release gate</h2>
          <p>
            The preloaded values are editable starter inputs. Change the observed behavior, run the gate,
            and TraceGate will generate a fresh verdict, scenario, evidence packet, SigNoz queries,
            dashboards, and alerts.
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={runJudgeGate} disabled={running}>
          <Play size={15} />
          {running ? "Running" : "Run judge gate"}
        </button>
      </div>

      <div className="judge-form">
        <label>
          <span>Service name</span>
          <input value={judgeInput.serviceName} onChange={updateText("serviceName")} />
        </label>
        <label>
          <span>Scenario ID</span>
          <input value={judgeInput.scenarioId} onChange={updateText("scenarioId")} />
        </label>
        <label>
          <span>Tool under test</span>
          <input value={judgeInput.toolName} onChange={updateText("toolName")} />
        </label>
        <label className="judge-form-wide">
          <span>Agent prompt</span>
          <textarea value={judgeInput.prompt} onChange={updateText("prompt")} rows={3} />
        </label>
        <label>
          <span>Retry budget</span>
          <input min={0} max={10} type="number" value={judgeInput.maxToolRetries} onChange={updateNumber("maxToolRetries")} />
        </label>
        <label>
          <span>Observed retries</span>
          <input min={0} max={20} type="number" value={judgeInput.observedRetries} onChange={updateNumber("observedRetries")} />
        </label>
        <label>
          <span>Cost budget USD</span>
          <input min={0} max={1} step="0.00001" type="number" value={judgeInput.maxRunCostUsd} onChange={updateNumber("maxRunCostUsd")} />
        </label>
        <label>
          <span>Observed cost USD</span>
          <input min={0} max={1} step="0.00001" type="number" value={judgeInput.observedCostUsd} onChange={updateNumber("observedCostUsd")} />
        </label>
        <label>
          <span>Latency budget ms</span>
          <input min={1} max={60000} type="number" value={judgeInput.maxP95LatencyMs} onChange={updateNumber("maxP95LatencyMs")} />
        </label>
        <label>
          <span>Observed latency ms</span>
          <input min={1} max={60000} type="number" value={judgeInput.observedLatencyMs} onChange={updateNumber("observedLatencyMs")} />
        </label>
      </div>
    </section>
  );
}

function RunsPage({ view, openEvidence }: { view: TraceGateView; openEvidence: (check?: GateCheck) => void }) {
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="Runs"
        title="Release attempts"
        copy="Compare scenario outcomes, contract checks, and the exact evidence attached to each verdict."
      />
      <div className="run-layout">
        <section className="panel">
          <PanelHeader title="Run history" />
          <div className="table-list">
            {["latest"].map((id) => (
              <button className="table-row selected" type="button" key={id}>
                <span className={view.reportSummary.status === "fail" ? "pill fail" : "pill pass"}>{view.reportSummary.status === "fail" ? "Blocked" : "Ready"}</span>
                <strong>{id}</strong>
                <span>{view.reportSummary.generatedAt}</span>
                <code>{view.reportSummary.serviceName}</code>
              </button>
            ))}
          </div>
        </section>
        <section className="panel wide">
          <PanelHeader title="Selected run detail" action="Evidence drawer" onAction={() => openEvidence()} />
          <ScenarioTimeline view={view} />
        </section>
      </div>
    </div>
  );
}

function ContractsPage({ view }: { view: TraceGateView }) {
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="Contracts"
        title="Define observable enough to ship"
        copy="The default contract turns spans, attributes, retries, cost, dashboards, and alerts into an explicit release bar."
      />
      <div className="editor-grid">
        <section className="panel">
          <PanelHeader title="Contract revisions" />
          <div className="contract-card active-card">
            <strong>agent-release.yaml</strong>
            <span>Version {view.reportSummary.contractVersion}</span>
            <code>{view.reportSummary.serviceName}</code>
          </div>
        </section>
        <section className="panel wide">
          <PanelHeader title="Visual check builder" />
          <div className="builder-grid">
            {view.gateChecks.map((check) => (
              <div className="builder-item" key={check.id}>
                <StatusIcon status={check.status} />
                <div>
                  <strong>{check.label}</strong>
                  <span>{check.severity} · {check.type}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel code-panel">
          <PanelHeader title="YAML preview" />
          <pre>{`budgets:
  maxRunCostUsd: 0.005
  maxP95LatencyMs: 2000
  maxToolRetries: 1
checks:
  - id: retry-budget-trace-lookup
    type: max-tool-retries
    toolName: trace.lookup
    maxRetries: 1`}</pre>
        </section>
      </div>
    </div>
  );
}

function ScenariosPage({
  view,
  judgeInput,
  setJudgeInput,
  runJudgeGate,
  runState
}: {
  view: TraceGateView;
  judgeInput: JudgeRunInput;
  setJudgeInput: Dispatch<SetStateAction<JudgeRunInput>>;
  runJudgeGate: () => Promise<void>;
  runState: RunState;
}) {
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="Scenarios"
        title="Agent missions that create useful telemetry"
        copy="Each scenario exercises a behavior path and expects a safe, explainable outcome."
      />
      <JudgeRunPanel
        judgeInput={judgeInput}
        setJudgeInput={setJudgeInput}
        runJudgeGate={runJudgeGate}
        runState={runState}
      />
      <div className="scenario-grid">
        {view.scenarios.map((scenario) => (
          <ScenarioCard scenario={scenario} key={scenario.id} />
        ))}
      </div>
    </div>
  );
}

function EvidencePage({ view, openEvidence }: { view: TraceGateView; openEvidence: (check?: GateCheck) => void }) {
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="Evidence"
        title="SigNoz investigation packets"
        copy="TraceGate packages failed checks into queries, spans, prompts, and exportable report context."
      />
      <div className="evidence-grid">
        <section className="panel wide">
          <PanelHeader title="Failed check evidence" action="Open drawer" onAction={() => openEvidence()} />
          <EvidenceCapture view={view} />
        </section>
        <section className="panel">
          <PanelHeader title="Suggested queries" />
          <div className="query-stack">
            <code>service.name = '{view.reportSummary.serviceName}'</code>
            <code>name CONTAINS 'agent.'</code>
            <code>name CONTAINS 'llm.' OR name CONTAINS 'tool.'</code>
            <code>name = '{primaryToolSpan(view)}'</code>
          </div>
        </section>
      </div>
    </div>
  );
}

function SignozPage({ view }: { view: TraceGateView }) {
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="SigNoz"
        title="Local observability bridge"
        copy="The Foundry stack is treated as product infrastructure: UI, OTLP, MCP, dashboards, alerts, and telemetry probes in one place."
      />
      <div className="signoz-grid">
        {signozEndpoints.map((endpoint) => (
          <section className="panel endpoint-card" key={endpoint.label}>
            <span className="status-dot" />
            <strong>{endpoint.label}</strong>
            <code>{endpoint.value}</code>
          </section>
        ))}
        <section className="panel wide">
          <PanelHeader title="Observed span names" />
          <div className="span-cloud">
            {view.spanNames.map((span) => (
              <code key={span}>{span}</code>
            ))}
          </div>
        </section>
        <section className="panel wide">
          <PanelHeader title="Dashboard artifacts" />
          <div className="artifact-list">
            {view.dashboardArtifacts.map((dashboard) => (
              <div className="artifact-row" key={dashboard}>
                <Check size={15} />
                <span>{dashboard}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AlertsPage({ view }: { view: TraceGateView }) {
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="Alerts"
        title="Reusable SigNoz alert definitions"
        copy="Convert contract risks into alert artifacts judges can inspect and teams can adapt."
      />
      <div className="artifact-grid">
        {view.alertArtifacts.map((alert) => (
          <section className="panel artifact-card" key={alert}>
            <AlertTriangle size={18} />
            <strong>{alert}</strong>
            <span>Defined in signoz/alerts.yaml</span>
          </section>
        ))}
      </div>
    </div>
  );
}

function SettingsPage({ view }: { view: TraceGateView }) {
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="Settings"
        title="Project and credential state"
        copy="Secrets are represented only by connection state. Values are never displayed inside the UI."
      />
      <div className="settings-grid">
        {[
          ["OpenAI API key", view.status?.hasOpenAIKey ? `Configured for ${view.status.model}` : "Missing; deterministic mode active", KeyRound],
          ["SigNoz target", "Local Foundry stack", ExternalLink],
          ["Report export", ".tracegate/runs/latest/report.json", Clipboard]
        ].map(([label, value, Icon]) => (
          <section className="panel setting-card" key={label as string}>
            <Icon size={18} />
            <div>
              <strong>{label as string}</strong>
              <span>{value as string}</span>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function MiniDashboard({ view, openApp }: { view: TraceGateView; openApp: () => void }) {
  return (
    <div className="mini-dashboard">
      <div className="mini-top">
        <span className={view.reportSummary.status === "fail" ? "pill fail" : "pill pass"}>
          {view.reportSummary.status === "fail" ? "Release blocked" : "Release ready"}
        </span>
        <button className="btn btn-secondary compact" type="button" onClick={openApp}>
          Inspect <ArrowRight size={14} />
        </button>
      </div>
      <MetricRow view={view} />
      <ScenarioTimeline view={view} compact />
    </div>
  );
}

function EvidenceCapture({ view }: { view: TraceGateView }) {
  const failed = view.gateChecks.find((check) => check.status === "fail") ?? view.gateChecks[0];
  const toolSpan = primaryToolSpan(view);
  return (
    <div className="evidence-capture">
      <div className="capture-left">
        <span className="pill fail">Critical</span>
        <h3>{failed.id}</h3>
        <p>{failed.evidence}</p>
        <code>name = '{toolSpan}'</code>
      </div>
      <div className="capture-right">
        <span>Noz prompt</span>
        <p>Why did this release fail its retry budget, and which span attributes prove it?</p>
      </div>
    </div>
  );
}

function MetricRow({ view }: { view: TraceGateView }) {
  return (
    <div className="metric-row">
      <Metric label="Checks" value={`${view.reportSummary.passed}/${view.reportSummary.totalChecks}`} />
      <Metric label="Critical failures" value={String(view.reportSummary.criticalFailures)} tone={view.reportSummary.criticalFailures ? "fail" : undefined} />
      <Metric label="Cost" value={view.reportSummary.totalCostUsd} />
      <Metric label="P95 latency" value={view.reportSummary.p95LatencyMs} />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "fail" }) {
  return (
    <section className={tone === "fail" ? "metric-card failed" : "metric-card"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}

function ScenarioTimeline({ view, compact = false }: { view: TraceGateView; compact?: boolean }) {
  return (
    <div className={compact ? "timeline compact" : "timeline"}>
      {view.scenarios.map((scenario) => (
        <div className={scenario.status === "fail" ? "timeline-row failed" : "timeline-row"} key={scenario.id}>
          <StatusIcon status={scenario.status === "pass" ? "pass" : "fail"} />
          <div>
            <strong>{scenario.id}</strong>
            {!compact ? <span>{scenario.prompt}</span> : null}
          </div>
          <code>{scenario.latency}</code>
        </div>
      ))}
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  return (
    <section className={scenario.status === "fail" ? "panel scenario-card failed" : "panel scenario-card"}>
      <div className="scenario-head">
        <StatusIcon status={scenario.status === "pass" ? "pass" : "fail"} />
        <strong>{scenario.id}</strong>
      </div>
      <p>{scenario.prompt}</p>
      <div className="scenario-meta">
        <span>Tools</span>
        <code>{scenario.tools.join(", ")}</code>
      </div>
      <div className="scenario-meta">
        <span>Retries</span>
        <code>{scenario.retries}</code>
      </div>
    </section>
  );
}

function EvidenceDrawer({
  open,
  onClose,
  check,
  view
}: {
  open: boolean;
  onClose: () => void;
  check: GateCheck;
  view: TraceGateView;
}) {
  const toolSpan = primaryToolSpan(view);
  return (
    <aside className={open ? "drawer open" : "drawer"} aria-hidden={!open}>
      <div className="drawer-head">
        <div>
          <p className="eyebrow">Evidence drawer</p>
          <h2>{check.label}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close evidence drawer">
          <X size={18} />
        </button>
      </div>
      <div className="drawer-section">
        <span className={check.status === "fail" ? "pill fail" : "pill pass"}>{check.status}</span>
        <p>{check.evidence}</p>
      </div>
      <div className="drawer-section">
        <strong>SigNoz query</strong>
        <code>service.name = '{view.reportSummary.serviceName}' AND name = '{toolSpan}'</code>
      </div>
      <div className="drawer-section">
        <strong>Noz prompt</strong>
        <p>Why did this release fail its retry budget, and which span attributes prove it?</p>
      </div>
      <button className="btn btn-primary" type="button">
        <Clipboard size={15} />
        Copy packet
      </button>
    </aside>
  );
}

function primaryToolSpan(view: TraceGateView): string {
  return view.spanNames.find((span) => span.startsWith("tool.")) ?? "tool.trace.lookup";
}

function SetupModal({ view, onClose }: { view: TraceGateView; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <section className="setup-modal">
        <div className="drawer-head">
          <div>
            <p className="eyebrow">First-run setup</p>
            <h2 id="setup-title">TraceGate is ready for the local stack</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close setup">
            <X size={18} />
          </button>
        </div>
        {[
          ["Detect environment", "SigNoz UI, OTLP, and MCP ports are configured."],
          ["Choose service", view.reportSummary.serviceName],
          ["Choose contract", "contracts/agent-release.yaml"],
          ["Choose scenario", "scenarios/support-agent.yaml"],
          ["Run gate", "Land on the blocked run detail with evidence."]
        ].map(([title, copy]) => (
          <div className="setup-step" key={title}>
            <Check size={16} />
            <div>
              <strong>{title}</strong>
              <span>{copy}</span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function RunProgress({ runState }: { runState: RunState }) {
  if (runState === "idle") return null;
  const labels: Record<RunState, string> = {
    idle: "",
    preparing: "Preparing scenario",
    telemetry: "Exporting telemetry",
    evaluating: "Evaluating contract",
    blocked: "Release blocked by retry evidence"
  };
  return (
    <div className="run-progress">
      <Activity size={16} />
      <span>{labels[runState]}</span>
      <div className={`progress-line ${runState}`} />
    </div>
  );
}

function PanelHeader({
  title,
  action,
  onAction
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <header className="panel-header">
      <h2>{title}</h2>
      {action ? (
        <button className="text-action" type="button" onClick={onAction}>
          {action} <ArrowRight size={14} />
        </button>
      ) : null}
    </header>
  );
}

function PageTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <header className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{copy}</p>
    </header>
  );
}

function StatusIcon({ status }: { status: "pass" | "fail" | "warn" }) {
  if (status === "fail") {
    return (
      <span className="status-icon fail">
        <X size={13} />
      </span>
    );
  }
  return (
    <span className="status-icon pass">
      <Check size={13} />
    </span>
  );
}

function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <b />
      </span>
      <span>TraceGate</span>
    </span>
  );
}
