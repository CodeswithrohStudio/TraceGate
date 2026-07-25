import { sendJson, status } from "./_tracegate.js";

export default async function handler(_request, response) {
  sendJson(response, await status());
}
