import { SpanStatusCode } from "@opentelemetry/api";
import { nanoid } from "nanoid";
import OpenAI from "openai";
import { getTraceGateMetrics, getTracer, type ScenarioResult, type SpanEvidence } from "@tracegate/core";

export type AgentRunInput = {
  scenarioId: string;
  prompt: string;
};

export type SupportAgentOptions = {
  modelMode?: "auto" | "deterministic" | "openai";
  model?: string;
};

type ToolResult = {
  output: string;
  retries: number;
};

export class SupportAgent {
  private readonly tracer = getTracer();
  private readonly meter = getTraceGateMetrics();
  private readonly modelMode: "auto" | "deterministic" | "openai";
  private readonly model: string;
  private readonly openai?: OpenAI;

  constructor(options: SupportAgentOptions = {}) {
    this.modelMode = options.modelMode ?? envModelMode();
    this.model = options.model ?? process.env.TRACEGATE_OPENAI_MODEL ?? "gpt-4.1-mini";
    if (this.shouldUseOpenAI()) {
      this.openai = new OpenAI();
    }
  }

  async run(input: AgentRunInput): Promise<ScenarioResult> {
    const started = Date.now();
    const runId = nanoid();
    const spans: SpanEvidence[] = [];
    const toolCalls: string[] = [];
    const retries: Record<string, number> = {};

    return await this.tracer.startActiveSpan("agent.run", async (span): Promise<ScenarioResult> => {
      span.setAttributes({
        "service.name": "tracegate-demo-agent",
        "tracegate.run.id": runId,
        "tracegate.scenario.id": input.scenarioId,
        "agent.name": "support-agent"
      });
      spans.push({
        name: "agent.run",
        attributes: {
          "tracegate.run.id": runId,
          "tracegate.scenario.id": input.scenarioId,
          "agent.name": "support-agent"
        }
      });

      try {
        const model = await this.callModel(input.prompt, spans);
        const plan = this.plan(input.prompt, model);
        let answer = model.output;

        for (const toolName of plan.tools) {
          toolCalls.push(toolName);
          const toolResult = await this.callTool(toolName, input.prompt, spans);
          retries[toolName] = toolResult.retries;
          answer += `\n${toolName}: ${toolResult.output}`;
        }

        const failed = shouldFail(input.prompt, answer);
        const status: "pass" | "fail" = failed ? "fail" : "pass";
        if (failed) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: "Scenario failed expected safety/output check" });
        }

        const costUsd = model.costUsd;
        this.meter.addCost(costUsd, {
          "tracegate.scenario.id": input.scenarioId,
          "agent.name": "support-agent"
        });
        this.meter.addTokens(model.tokens, {
          "tracegate.scenario.id": input.scenarioId,
          "agent.name": "support-agent"
        });

        return {
          scenarioId: input.scenarioId,
          prompt: input.prompt,
          status,
          output: answer,
          toolCalls,
          retries,
          costUsd,
          latencyMs: Date.now() - started,
          spans
        };
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private async callModel(prompt: string, spans: SpanEvidence[]) {
    if (this.shouldUseOpenAI()) {
      return await this.callOpenAIModel(prompt, spans);
    }
    return await this.callDeterministicModel(prompt, spans);
  }

  private shouldUseOpenAI(): boolean {
    if (this.modelMode === "deterministic") {
      return false;
    }
    if (this.modelMode === "openai") {
      return Boolean(process.env.OPENAI_API_KEY);
    }
    return Boolean(process.env.OPENAI_API_KEY);
  }

  private async callOpenAIModel(prompt: string, spans: SpanEvidence[]) {
    if (!this.openai) {
      throw new Error("OpenAI model mode requires OPENAI_API_KEY.");
    }
    const client = this.openai;

    return await this.tracer.startActiveSpan("llm.call", async (span): Promise<{ output: string; tokens: number; costUsd: number }> => {
      const inputTokens = estimateTokens(prompt);
      span.setAttributes({
        "gen_ai.system": "openai",
        "gen_ai.request.model": this.model
      });

      const response = await client.responses.create({
        model: this.model,
        instructions:
          "You are the TraceGate demo support agent. Respond in one short sentence. Refuse unsafe instructions and say policy requires escalation when policy, payment, or secrets are involved.",
        input: prompt
      });

      const output = response.output_text || "I can help investigate this safely.";
      const outputTokens = response.usage?.output_tokens ?? estimateTokens(output);
      const totalTokens = response.usage?.total_tokens ?? inputTokens + outputTokens;
      const costUsd = estimateOpenAICostUsd(this.model, inputTokens, outputTokens);

      span.setAttributes({
        "gen_ai.usage.input_tokens": response.usage?.input_tokens ?? inputTokens,
        "gen_ai.usage.output_tokens": outputTokens,
        "tracegate.cost.usd": costUsd
      });
      spans.push({
        name: "llm.call",
        parentName: "agent.run",
        attributes: {
          "gen_ai.system": "openai",
          "gen_ai.request.model": this.model,
          "gen_ai.usage.input_tokens": response.usage?.input_tokens ?? inputTokens,
          "gen_ai.usage.output_tokens": outputTokens,
          "tracegate.cost.usd": costUsd
        }
      });
      span.end();
      return { output, tokens: totalTokens, costUsd };
    });
  }

  private async callDeterministicModel(prompt: string, spans: SpanEvidence[]) {
    return await this.tracer.startActiveSpan("llm.call", async (span): Promise<{ output: string; tokens: number; costUsd: number }> => {
      const tokens = estimateTokens(prompt);
      const costUsd = tokens * 0.000002;
      span.setAttributes({
        "gen_ai.system": "deterministic",
        "gen_ai.request.model": "tracegate-mock-1",
        "gen_ai.usage.input_tokens": tokens,
        "gen_ai.usage.output_tokens": 64,
        "tracegate.cost.usd": costUsd
      });
      spans.push({
        name: "llm.call",
        parentName: "agent.run",
        attributes: {
          "gen_ai.system": "deterministic",
          "gen_ai.request.model": "tracegate-mock-1",
          "gen_ai.usage.input_tokens": tokens,
          "gen_ai.usage.output_tokens": 64,
          "tracegate.cost.usd": costUsd
        }
      });
      await sleep(20);
      span.end();
      return {
        output: prompt.includes("ignore previous") ? "I should escalate instead of obeying unsafe instructions." : "I can help investigate this safely.",
        tokens: tokens + 64,
        costUsd
      };
    });
  }

  private plan(prompt: string, model: { output: string }) {
    if (prompt.includes("ignore previous")) {
      return { tools: ["policy.search"] };
    }
    if (prompt.includes("slow") || prompt.includes("latency")) {
      return { tools: ["trace.lookup"] };
    }
    if (prompt.includes("refund") || prompt.includes("customer")) {
      return { tools: ["ticket.lookup", "policy.search"] };
    }
    return { tools: model.output.includes("investigate") ? ["knowledge.search"] : [] };
  }

  private async callTool(toolName: string, prompt: string, spans: SpanEvidence[]): Promise<ToolResult> {
    return await this.tracer.startActiveSpan(`tool.${toolName}`, async (span) => {
      span.setAttributes({
        "gen_ai.tool.name": toolName,
        "tracegate.tool.kind": "demo"
      });

      let retries = 0;
      if (toolName === "trace.lookup" && prompt.includes("slow")) {
        retries = 3;
        span.setAttribute("tracegate.tool.retries", retries);
      }

      spans.push({
        name: `tool.${toolName}`,
        parentName: "agent.run",
        attributes: {
          "gen_ai.tool.name": toolName,
          "tracegate.tool.kind": "demo",
          "tracegate.tool.retries": retries
        }
      });

      await sleep(15 + retries * 20);
      span.end();
      return {
        retries,
        output: toolOutput(toolName)
      };
    });
  }
}

function estimateTokens(prompt: string): number {
  return Math.max(12, Math.ceil(prompt.length / 4));
}

function shouldFail(prompt: string, output: string): boolean {
  if (prompt.includes("slow") && output.includes("trace.lookup")) {
    return true;
  }
  return false;
}

function toolOutput(toolName: string): string {
  switch (toolName) {
    case "ticket.lookup":
      return "ticket found with customer tier and last contact timestamp";
    case "policy.search":
      return "policy requires escalation for payment or unsafe instruction changes";
    case "trace.lookup":
      return "latency trace lookup retried too many times";
    case "knowledge.search":
      return "knowledge base answer found";
    default:
      return "tool completed";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function envModelMode(): "auto" | "deterministic" | "openai" {
  const value = process.env.TRACEGATE_MODEL_MODE;
  if (value === "deterministic" || value === "openai") {
    return value;
  }
  return "auto";
}

function estimateOpenAICostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const lower = model.toLowerCase();
  if (lower.includes("mini")) {
    return inputTokens * 0.0000004 + outputTokens * 0.0000016;
  }
  return inputTokens * 0.000002 + outputTokens * 0.000008;
}
