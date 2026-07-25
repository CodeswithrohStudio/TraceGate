import { runGate, sendJson } from "./_tracegate.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, { error: "Method not allowed" }, 405);
    return;
  }

  try {
    sendJson(response, await runGate(request.body ?? {}));
  } catch (error) {
    sendJson(response, { ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
