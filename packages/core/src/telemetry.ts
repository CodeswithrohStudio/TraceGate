import { metrics, trace, type Attributes } from "@opentelemetry/api";

export type TraceGateMetrics = {
  addCost: (costUsd: number, attributes: Attributes) => void;
  addTokens: (tokens: number, attributes: Attributes) => void;
};

export function getTracer() {
  return trace.getTracer("tracegate", "0.1.0");
}

export function getTraceGateMetrics(): TraceGateMetrics {
  const meter = metrics.getMeter("tracegate", "0.1.0");
  const costCounter = meter.createCounter("tracegate.agent.cost.usd", {
    description: "Estimated LLM/tool cost in USD for TraceGate agent runs"
  });
  const tokenCounter = meter.createCounter("tracegate.agent.tokens", {
    description: "Estimated token usage for TraceGate agent runs"
  });

  return {
    addCost: (costUsd, attributes) => costCounter.add(costUsd, attributes),
    addTokens: (tokens, attributes) => tokenCounter.add(tokens, attributes)
  };
}
