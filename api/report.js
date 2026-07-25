import { reportPayload, sendJson } from "./_tracegate.js";

export default async function handler(_request, response) {
  sendJson(response, await reportPayload());
}
