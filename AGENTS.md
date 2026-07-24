# TraceGate Agent Notes

TraceGate is a hackathon project for SigNoz. Keep the build backend-first and demo-proof:

- Do not commit secrets.
- Prefer deterministic demo mode so judges can run without paid LLM credentials.
- Use OpenTelemetry semantic conventions where available.
- Treat high-cardinality attributes carefully: request IDs, user IDs, raw URLs, prompts, and trace IDs belong on traces/logs, not metric labels.
- Any "works with SigNoz" claim must be backed by a command, screenshot, exported report, or clear verification note.
- Use Foundry for local SigNoz deployment artifacts.
