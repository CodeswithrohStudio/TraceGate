import { z } from "zod";

export const SeveritySchema = z.enum(["info", "warning", "critical"]);

export const ContractCheckSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("required-span"),
    description: z.string().min(1),
    spanName: z.string().min(1),
    severity: SeveritySchema.default("critical")
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("required-attribute"),
    description: z.string().min(1),
    spanName: z.string().min(1),
    attribute: z.string().min(1),
    severity: SeveritySchema.default("critical")
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("max-cost-usd"),
    description: z.string().min(1),
    maxUsd: z.number().nonnegative(),
    severity: SeveritySchema.default("warning")
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("max-tool-retries"),
    description: z.string().min(1),
    toolName: z.string().min(1),
    maxRetries: z.number().int().nonnegative(),
    severity: SeveritySchema.default("critical")
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("scenario-must-pass"),
    description: z.string().min(1),
    scenarioId: z.string().min(1),
    severity: SeveritySchema.default("critical")
  })
]);

export const ObservabilityContractSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  serviceName: z.string().min(1),
  slo: z.object({
    target: z.number().min(0).max(1),
    window: z.string().min(1)
  }),
  budgets: z.object({
    maxRunCostUsd: z.number().nonnegative(),
    maxP95LatencyMs: z.number().positive(),
    maxToolRetries: z.number().int().nonnegative()
  }),
  requiredDashboards: z.array(z.string()).default([]),
  requiredAlerts: z.array(z.string()).default([]),
  checks: z.array(ContractCheckSchema).min(1)
});

export const ScenarioStepSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  expect: z.object({
    status: z.enum(["pass", "fail"]),
    contains: z.string().optional(),
    toolCalls: z.array(z.string()).optional()
  })
});

export const ScenarioSuiteSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  serviceName: z.string().min(1),
  steps: z.array(ScenarioStepSchema).min(1)
});

export type Severity = z.infer<typeof SeveritySchema>;
export type ContractCheck = z.infer<typeof ContractCheckSchema>;
export type ObservabilityContract = z.infer<typeof ObservabilityContractSchema>;
export type ScenarioStep = z.infer<typeof ScenarioStepSchema>;
export type ScenarioSuite = z.infer<typeof ScenarioSuiteSchema>;

export type SpanEvidence = {
  name: string;
  attributes: Record<string, string | number | boolean>;
  parentName?: string;
};

export type ScenarioResult = {
  scenarioId: string;
  prompt: string;
  status: "pass" | "fail";
  output: string;
  toolCalls: string[];
  retries: Record<string, number>;
  costUsd: number;
  latencyMs: number;
  spans: SpanEvidence[];
};
