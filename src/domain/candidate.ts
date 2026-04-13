export type CheckStatus = "passed" | "failed" | "missing";
export type SignatureStatus = "valid" | "invalid" | "missing";
export type PromotionStatus = "draft" | "promoted" | "blocked";

export interface QualitySignals {
  unitTests: CheckStatus;
  integrationTests: CheckStatus;
  securityScan: CheckStatus;
  attestation: CheckStatus;
  signature: SignatureStatus;
  coveragePct: number;
}

export interface PromotionState {
  status: PromotionStatus;
  reasons: string[];
  promotedAt?: string;
}

export interface ReleaseCandidate {
  id: string;
  name: string;
  version: string;
  image: string;
  createdAt: string;
  updatedAt: string;
  qualitySignals: QualitySignals;
  promotion: PromotionState;
}

const defaultQualitySignals: QualitySignals = {
  unitTests: "passed",
  integrationTests: "passed",
  securityScan: "passed",
  attestation: "passed",
  signature: "valid",
  coveragePct: 85,
};

function asRecord(value: unknown, errorMessage: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(errorMessage);
  }

  return value as Record<string, unknown>;
}

function readRequiredText(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

function readCoveragePct(value: unknown): number {
  if (value === undefined) {
    return defaultQualitySignals.coveragePct;
  }

  if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 100) {
    throw new Error("qualitySignals.coveragePct must be a number between 0 and 100.");
  }

  return Number(value.toFixed(2));
}

function readCheckStatus(value: unknown, fieldName: string, fallback: CheckStatus): CheckStatus {
  if (value === undefined) {
    return fallback;
  }

  if (value === "passed" || value === "failed" || value === "missing") {
    return value;
  }

  throw new Error(`${fieldName} must be one of: passed, failed, missing.`);
}

function readSignatureStatus(value: unknown): SignatureStatus {
  if (value === undefined) {
    return defaultQualitySignals.signature;
  }

  if (value === "valid" || value === "invalid" || value === "missing") {
    return value;
  }

  throw new Error("qualitySignals.signature must be one of: valid, invalid, missing.");
}

export function createCandidate(payload: unknown, timestamp: string, id: string): ReleaseCandidate {
  const record = asRecord(payload, "Candidate payload must be an object.");
  const qualitySignalInput = record.qualitySignals
    ? asRecord(record.qualitySignals, "qualitySignals must be an object when provided.")
    : undefined;

  return {
    id,
    name: readRequiredText(record.name, "name"),
    version: readRequiredText(record.version, "version"),
    image: readRequiredText(record.image, "image"),
    createdAt: timestamp,
    updatedAt: timestamp,
    qualitySignals: {
      unitTests: readCheckStatus(qualitySignalInput?.unitTests, "qualitySignals.unitTests", defaultQualitySignals.unitTests),
      integrationTests: readCheckStatus(
        qualitySignalInput?.integrationTests,
        "qualitySignals.integrationTests",
        defaultQualitySignals.integrationTests,
      ),
      securityScan: readCheckStatus(
        qualitySignalInput?.securityScan,
        "qualitySignals.securityScan",
        defaultQualitySignals.securityScan,
      ),
      attestation: readCheckStatus(
        qualitySignalInput?.attestation,
        "qualitySignals.attestation",
        defaultQualitySignals.attestation,
      ),
      signature: readSignatureStatus(qualitySignalInput?.signature),
      coveragePct: readCoveragePct(qualitySignalInput?.coveragePct),
    },
    promotion: {
      status: "draft",
      reasons: [],
    },
  };
}
