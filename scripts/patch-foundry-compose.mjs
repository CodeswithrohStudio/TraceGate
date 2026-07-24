import { readFileSync, writeFileSync } from "node:fs";

const replacements = [
  {
    file: "pours/deployment/ingester/opamp.yaml",
    from: "ws://tracegate-signoz-mcp:4320/v1/opamp",
    to: "ws://tracegate-signoz-signoz-0:4320/v1/opamp"
  },
  {
    file: "pours/deployment/compose.yaml",
    from: "SIGNOZ_URL=http://tracegate-signoz-mcp:8080",
    to: "SIGNOZ_URL=http://tracegate-signoz-signoz-0:8080"
  },
  {
    file: "pours/deployment/compose.yaml",
    from: "/signoz-otel-collector --config=/etc/otel-collector-config.yaml --manager-config=/etc/opamp-config.yaml --copy-path=/var/tmp/collector-config.yaml",
    to: "/signoz-otel-collector --config=/etc/otel-collector-config.yaml"
  }
];

for (const replacement of replacements) {
  const input = readFileSync(replacement.file, "utf8");
  const output = input.split(replacement.from).join(replacement.to);
  if (input !== output) {
    writeFileSync(replacement.file, output);
    console.log(`patched ${replacement.file}`);
  } else {
    console.log(`already patched ${replacement.file}`);
  }
}
