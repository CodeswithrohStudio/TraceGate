# Verification Log

## 2026-07-24

- `npm install` completed.
- `npm run check` passed.
- `npm run demo -- --no-telemetry` intentionally failed the release gate because `trace.lookup` retried 3 times against a max retry budget of 1.

## Current Expected Demo

The default release candidate is intentionally blocked. This is useful for the hackathon demo because it proves TraceGate is not just producing a pretty report; it can stop an unsafe or undebuggable agent release.
