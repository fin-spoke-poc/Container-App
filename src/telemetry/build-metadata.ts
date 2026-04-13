export interface BuildMetadata {
  serviceName: string;
  version: string;
  gitSha: string;
  imageTag: string;
  buildTimestamp: string;
  workflowName: string;
  workflowRef: string;
  rulesetIds: string[];
  environment: string;
  coverageThresholdPct: number;
}

export type EnvMap = Record<string, string | undefined>;

function parseCoverageThreshold(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "60", 10);
  return Number.isNaN(parsed) ? 60 : parsed;
}

export function getBuildMetadata(env: EnvMap = process.env): BuildMetadata {
  return {
    serviceName: env.APP_NAME ?? "container-app",
    version: env.APP_VERSION ?? "0.1.0",
    gitSha: env.GIT_SHA ?? env.GITHUB_SHA ?? "local",
    imageTag: env.IMAGE_TAG ?? env.GIT_SHA ?? "local",
    buildTimestamp: env.BUILD_TIMESTAMP ?? new Date().toISOString(),
    workflowName: env.GITHUB_WORKFLOW ?? env.WORKFLOW_NAME ?? "local",
    workflowRef: env.GITHUB_WORKFLOW_REF ?? env.WORKFLOW_REF ?? "local",
    rulesetIds: (env.RULESET_IDS ?? "local-bootstrap")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    environment: env.ENVIRONMENT ?? env.NODE_ENV ?? "local",
    coverageThresholdPct: parseCoverageThreshold(env.COVERAGE_THRESHOLD_PCT),
  };
}
