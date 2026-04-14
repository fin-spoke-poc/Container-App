import { spawn } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const coverageThresholdPct = Number.parseInt(process.env.COVERAGE_THRESHOLD_PCT ?? "60", 10);
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const compiledTestRoot = fileURLToPath(new URL("../dist/test", import.meta.url));

async function findCompiledTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        return findCompiledTestFiles(entryPath);
      }

      return entry.name.endsWith(".test.js") ? [relative(projectRoot, entryPath)] : [];
    }),
  );

  return results.flat().sort();
}

await mkdir(new URL("../coverage", import.meta.url), { recursive: true });
await mkdir(new URL("../reports", import.meta.url), { recursive: true });

const compiledTestFiles = await findCompiledTestFiles(compiledTestRoot);

if (compiledTestFiles.length === 0) {
  throw new Error(`No compiled test files were found under ${relative(projectRoot, compiledTestRoot)}.`);
}

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
  ...compiledTestFiles,
];

const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(binary, args, { shell: false, stdio: "inherit" });
  child.once("error", reject);
  child.once("close", resolve);
});

process.exit(typeof exitCode === "number" ? exitCode : 1);
