import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const coverageSummaryPath = new URL("../coverage/coverage-summary.json", import.meta.url);
const junitPath = new URL("../reports/junit.xml", import.meta.url);
const sbomPath = new URL("../artifacts/sbom.spdx.json", import.meta.url);
const outputPath = new URL("../artifacts/attestation-evidence.json", import.meta.url);

function sha256(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

async function readOptionalFile(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

function readAttribute(attributes, name) {
  const match = attributes.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match?.[1];
}

function parseJUnit(xml) {
  if (!xml) {
    return {
      integrationTestsPassed: 0,
      totalFailed: 0,
      totalPassed: 0,
      unitTestsPassed: 0,
    };
  }

  const suitePattern = /<testsuite\b([^>]*)>/g;
  let totalPassed = 0;
  let totalFailed = 0;
  let unitTestsPassed = 0;
  let integrationTestsPassed = 0;

  for (const match of xml.matchAll(suitePattern)) {
    const attributes = match[1] ?? "";
    const suiteName = (readAttribute(attributes, "name") ?? "").toLowerCase();
    const tests = Number.parseInt(readAttribute(attributes, "tests") ?? "0", 10) || 0;
    const failures = Number.parseInt(readAttribute(attributes, "failures") ?? "0", 10) || 0;
    const skipped = Number.parseInt(readAttribute(attributes, "skipped") ?? "0", 10) || 0;
    const passed = Math.max(tests - failures - skipped, 0);

    totalPassed += passed;
    totalFailed += failures;

    if (suiteName.includes("unit")) {
      unitTestsPassed += passed;
    }

    if (suiteName.includes("integration")) {
      integrationTestsPassed += passed;
    }
  }

  return { integrationTestsPassed, totalFailed, totalPassed, unitTestsPassed };
}

const coverageSummaryRaw = await readOptionalFile(coverageSummaryPath);
const junitRaw = await readOptionalFile(junitPath);
const sbomRaw = await readOptionalFile(sbomPath);
const coverageSummary = coverageSummaryRaw ? JSON.parse(coverageSummaryRaw) : undefined;

const coverageMetrics = coverageSummary?.total
  ? [
      coverageSummary.total.lines.pct,
      coverageSummary.total.statements.pct,
      coverageSummary.total.functions.pct,
      coverageSummary.total.branches.pct,
    ]
  : [0];

const coveragePct = Math.min(...coverageMetrics).toFixed(2);
const coverageThresholdPct = Number.parseInt(process.env.COVERAGE_THRESHOLD_PCT ?? "60", 10) || 60;
const testSummary = parseJUnit(junitRaw);

const evidence = {
  repo: process.env.GITHUB_REPOSITORY?.split("/").at(-1) ?? "Container-App",
  app: process.env.APP_NAME ?? packageJson.name,
  version: packageJson.version,
  environment: process.env.ENVIRONMENT ?? "local",
  commit_sha: process.env.GIT_SHA ?? process.env.GITHUB_SHA ?? "local",
  image: process.env.IMAGE_NAME ?? `ghcr.io/local/${packageJson.name}`,
  image_tag: process.env.IMAGE_TAG ?? process.env.GIT_SHA ?? "local",
  image_digest: process.env.IMAGE_DIGEST ?? "pending-publish",
  coverage_pct: Number(coveragePct),
  coverage_threshold_pct: coverageThresholdPct,
  coverage_report_digest: coverageSummaryRaw ? sha256(coverageSummaryRaw) : "missing",
  tests_passed_total: testSummary.totalPassed,
  tests_failed_total: testSummary.totalFailed,
  unit_tests_passed: testSummary.unitTestsPassed,
  integration_tests_passed: testSummary.integrationTestsPassed,
  sbom_digest: sbomRaw ? sha256(sbomRaw) : "missing",
  attestation_result: process.env.ATTESTATION_RESULT ?? "pending-external",
  signature_result: process.env.SIGNATURE_RESULT ?? "pending-external",
  workflow_name: process.env.GITHUB_WORKFLOW ?? "app-ci",
  workflow_ref: process.env.GITHUB_WORKFLOW_REF ?? "local",
  ruleset_ids: (process.env.RULESET_IDS ?? "bootstrap-local-ci")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  generated_at: new Date().toISOString(),
};

await mkdir(new URL("../artifacts", import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
