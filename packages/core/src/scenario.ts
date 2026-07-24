import { readFile } from "node:fs/promises";
import YAML from "yaml";
import {
  ObservabilityContractSchema,
  ScenarioSuiteSchema,
  type ObservabilityContract,
  type ScenarioSuite
} from "./schema.js";

export async function readScenarioSuite(path: string): Promise<ScenarioSuite> {
  const raw = await readFile(path, "utf8");
  return ScenarioSuiteSchema.parse(YAML.parse(raw));
}

export async function readContract(path: string): Promise<ObservabilityContract> {
  const raw = await readFile(path, "utf8");
  return ObservabilityContractSchema.parse(YAML.parse(raw));
}
