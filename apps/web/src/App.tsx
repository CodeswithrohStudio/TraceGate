import { useEffect, useState } from "react";
import { gsap } from "gsap";
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
  Play,
  Search,
  ShieldAlert,
  X
} from "lucide-react";
import {
  defaultView,
  landingProof,
  navItems,
  signozEndpoints,
  viewFromReport,
  workflowSteps
} from "./data";
import type { GateCheck, RuntimeStatus, Scenario, TraceGateReport, TraceGateView } from "./data";

type RunState = "idle" | "preparing" | "telemetry" | "evaluating" | "blocked";

const appPaths = new Set(navItems.map((item) => item.path));

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [view, setView] = useState<TraceGateView>(defaultView);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<GateCheck>(
    defaultView.gateChecks.find((check) => check.status === "fail") ?? defaultView.gateChecks[0]
  );
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
      gsap.from("[data-reveal]", {
        y: 12,
        opacity: 0,
        duration: 0.24,
        ease: "power2.out",
        stagger: 0.04
      });
    }, document.body);
    return () => ctx.revert();
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
    setTimeout(() => setRunState("telemetry"), 450);
    setTimeout(() => setRunState("evaluating"), 900);
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

  const showApp = path === "/app" || path.startsWith("/app/");

  if (!showApp) {
    return <LandingPage view={view} navigate={navigate} openEvidence={() => navigate("/app/evidence")} />;
  }

  return (
    <AppShell
      path={appPaths.has(path) ? path : "/app"}
      navigate={navigate}
      runGate={runGate}
      runState={runState}
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

function LandingPage({
  view,
  navigate,
  openEvidence
}: {
  view: TraceGateView;
  navigate: (path: string) => void;
  openEvidence: () => void;
}) {
  const proofTiles = landingProof.map((item) => ({
    ...item,
    value:
      item.label === "Checks evaluated"
        ? String(view.reportSummary.totalChecks)
        : item.label === "Passed"
          ? String(view.reportSummary.passed)
          : item.label === "Critical failure"
            ? String(view.reportSummary.criticalFailures)
            : view.reportSummary.p95LatencyMs
  }));

  return (
    <main className="site-shell">
      <nav className="landing-nav" data-reveal>
        <Brand />
        <div className="nav-cluster" aria-label="Primary">
          <a href="#product">Product</a>
          <a href="#evidence">Evidence</a>
          <a href="#signoz">SigNoz</a>
          <a href="/docs/PRODUCT_FLOW.md">Docs</a>
        </div>
        <button className="command-pill" type="button" aria-label="Open command search">
          <Command size={15} />
          <span>Search</span>
          <kbd>⌘K</kbd>
        </button>
        <button className="btn btn-primary" type="button" onClick={() => navigate("/app")}>
          Open workbench <ArrowRight size={16} />
        </button>
      </nav>

      <section className="hero-grid">
        <div className="hero-copy" data-reveal>
          <p className="eyebrow">SigNoz release evidence for AI agents</p>
          <h1>Stop blind agent releases before they ship</h1>
          <p className="hero-lede">
            TraceGate runs agent scenarios, sends telemetry to SigNoz, and blocks releases that
            are not observable enough to debug.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" type="button" onClick={() => navigate("/app")}>
              Open workbench <ArrowRight size={16} />
            </button>
            <button className="btn btn-secondary" type="button" onClick={openEvidence}>
              View evidence <Eye size={16} />
            </button>
          </div>
        </div>
        <ReleaseVerdictMockup view={view} className="hero-visual" />
      </section>

      <section className="proof-strip" id="product" data-reveal>
        {proofTiles.map((item) => (
          <div className="proof-tile" key={item.label}>
            <item.icon size={18} />
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </section>

      <section className="workbench-band" data-reveal>
        <div className="section-copy">
          <p className="eyebrow">Workbench proof</p>
          <h2>The first screen is the release decision</h2>
          <p>
            TraceGate starts from the question engineers actually ask before deploy: can this
            agent be shipped, investigated, and held to an observability contract?
          </p>
        </div>
        <MiniDashboard view={view} openApp={() => navigate("/app")} />
      </section>

      <section className="workflow-section" data-reveal>
        <div className="section-copy">
          <p className="eyebrow">How the gate works</p>
          <h2>Contract to verdict, with SigNoz in the loop</h2>
        </div>
        <div className="workflow-grid">
          {workflowSteps.map((step, index) => (
            <article className="workflow-card" key={step.title}>
              <div className="step-number">{String(index + 1).padStart(2, "0")}</div>
              <step.icon size={20} />
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="evidence-band" id="evidence" data-reveal>
        <EvidenceCapture view={view} />
        <div className="section-copy">
          <p className="eyebrow">Evidence, not vibes</p>
          <h2>Every blocked release needs a useful next question</h2>
          <p>
            The default candidate fails because `trace.lookup` retries three times against a max
            retry budget of one. The product turns that into a trace query and Noz prompt.
          </p>
        </div>
      </section>

      <section className="spec-section" id="signoz" data-reveal>
        <div className="section-copy">
          <p className="eyebrow">SigNoz expansion</p>
          <h2>New use cases without replacing the observability stack</h2>
        </div>
        <div className="spec-table">
          {[
            ["Dashboards", "Release overview, LLM cost, tool retry loops"],
            ["Alerts", "Failure rate, retry loops, cost budget"],
            ["Noz prompts", "Why did this release fail its retry budget?"],
            ["MCP", "Local endpoint at http://localhost:8000/mcp"]
          ].map(([label, value]) => (
            <div className="spec-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="closing-cta" data-reveal>
        <h2>Run the gate against the demo agent</h2>
        <button className="btn btn-primary" type="button" onClick={() => navigate("/app")}>
          Enter TraceGate <ArrowRight size={16} />
        </button>
      </section>

      <footer className="site-footer">
        <Brand />
        <span>OpenTelemetry contracts for SigNoz-backed AI agent releases.</span>
      </footer>
    </main>
  );
}

function AppShell({
  path,
  navigate,
  runGate,
  runState,
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
  runState: RunState;
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
          <CurrentPage path={path} openEvidence={openEvidence} navigate={navigate} view={view} />
        </div>
      </section>

      <EvidenceDrawer
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        check={selectedCheck}
      />
      {setupOpen ? <SetupModal view={view} onClose={() => setSetupOpen(false)} /> : null}
    </div>
  );
}

function CurrentPage({
  path,
  openEvidence,
  navigate,
  view
}: {
  path: string;
  openEvidence: (check?: GateCheck) => void;
  navigate: (path: string) => void;
  view: TraceGateView;
}) {
  if (path === "/app/runs") return <RunsPage view={view} openEvidence={openEvidence} />;
  if (path === "/app/contracts") return <ContractsPage view={view} />;
  if (path === "/app/scenarios") return <ScenariosPage view={view} />;
  if (path === "/app/evidence") return <EvidencePage view={view} openEvidence={openEvidence} />;
  if (path === "/app/signoz") return <SignozPage view={view} />;
  if (path === "/app/alerts") return <AlertsPage view={view} />;
  if (path === "/app/settings") return <SettingsPage view={view} />;
  return <OverviewPage view={view} openEvidence={openEvidence} navigate={navigate} />;
}

function OverviewPage({
  view,
  openEvidence,
  navigate
}: {
  view: TraceGateView;
  openEvidence: (check?: GateCheck) => void;
  navigate: (path: string) => void;
}) {
  const failed = view.gateChecks.find((check) => check.status === "fail");
  const isBlocked = view.reportSummary.status === "fail";
  return (
    <div className="page-grid overview-grid">
      <section className="verdict-panel">
        <div>
          <p className="eyebrow">Latest release verdict</p>
          <h1>{isBlocked ? "Blocked by retry evidence" : "Ready with trace evidence"}</h1>
          <p>
            {view.reportSummary.passed} of {view.reportSummary.totalChecks} checks passed.
            {isBlocked
              ? " One critical contract failure prevents this agent from shipping."
              : " The release is observable enough to ship."}
          </p>
        </div>
        <div className="verdict-badge">
          <ShieldAlert size={22} />
          {isBlocked ? "BLOCKED" : "READY"}
        </div>
      </section>

      <MetricRow view={view} />

      <section className="panel wide">
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

      <section className="panel">
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

function ScenariosPage({ view }: { view: TraceGateView }) {
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="Scenarios"
        title="Agent missions that create useful telemetry"
        copy="Each scenario exercises a behavior path and expects a safe, explainable outcome."
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
            <code>service.name = 'tracegate-demo-agent'</code>
            <code>name CONTAINS 'agent.'</code>
            <code>name CONTAINS 'llm.' OR name CONTAINS 'tool.'</code>
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

function ReleaseVerdictMockup({ view, className = "" }: { view: TraceGateView; className?: string }) {
  const failed = view.gateChecks.find((check) => check.status === "fail") ?? view.gateChecks[0];
  const isBlocked = view.reportSummary.status === "fail";
  return (
    <figure className={`release-mock ${className}`} data-reveal>
      <div className="mock-header">
        <span>latest/report.json</span>
        <strong>TraceGate verdict</strong>
      </div>
      <div className="mock-verdict">
        <span className={isBlocked ? "pill fail" : "pill pass"}>{isBlocked ? "Blocked" : "Ready"}</span>
        <strong>{failed.label}</strong>
        <p>{failed.evidence}</p>
      </div>
      <div className="trace-waterfall" aria-label="Trace waterfall">
        {view.spanNames.map((span, index) => (
          <div className={`trace-row trace-${index}`} key={span}>
            <span>{span}</span>
            <i />
          </div>
        ))}
      </div>
      <div className="mock-footer">
        <code>service.name = 'tracegate-demo-agent'</code>
        <span>Noz prompt ready</span>
      </div>
    </figure>
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
  return (
    <div className="evidence-capture">
      <div className="capture-left">
        <span className="pill fail">Critical</span>
        <h3>{failed.id}</h3>
        <p>{failed.evidence}</p>
        <code>name = 'tool.trace.lookup'</code>
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
  check
}: {
  open: boolean;
  onClose: () => void;
  check: GateCheck;
}) {
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
        <code>service.name = 'tracegate-demo-agent' AND name = 'tool.trace.lookup'</code>
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
