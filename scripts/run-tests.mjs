import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";

const coverageThresholdPct = Number.parseInt(process.env.COVERAGE_THRESHOLD_PCT ?? "60", 10);

await mkdir(new URL("../coverage", import.meta.url), { recursive: true });
await mkdir(new URL("../reports", import.meta.url), { recursive: true });

const binary = process.platform === "win32" ? "c8.cmd" : "c8";
const args = [
  "--check-coverage",
  "--lines",
  String(coverageThresholdPct),
  "--functions",
  String(coverageThresholdPct),
  "--branches",
  String(coverageThresholdPct),
  "--statements",
  String(coverageThresholdPct),
  "--reporter=text",
  "--reporter=lcov",
  "--reporter=cobertura",
  "--reporter=json-summary",
  "--reports-dir",
  "coverage",
  "node",
  "--test",
  "--test-reporter=junit",
  "--test-reporter-destination=reports/junit.xml",
  "dist/test",
];

const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(binary, args, { shell: false, stdio: "inherit" });
  child.once("error", reject);
  child.once("close", resolve);
});

process.exit(typeof exitCode === "number" ? exitCode : 1);
