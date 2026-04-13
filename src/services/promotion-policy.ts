import type { PromotionState, ReleaseCandidate } from "../domain/candidate.js";

export interface PromotionDecision {
  allowed: boolean;
  reasons: string[];
  coverageThresholdPct: number;
}

function buildBlockedState(reasons: string[]): PromotionState {
  return {
    status: "blocked",
    reasons,
  };
}

export function evaluatePromotion(candidate: ReleaseCandidate, coverageThresholdPct: number): PromotionDecision {
  const reasons: string[] = [];
  const { qualitySignals } = candidate;

  if (qualitySignals.unitTests !== "passed") {
    reasons.push("Unit tests must pass before promotion.");
  }

  if (qualitySignals.integrationTests !== "passed") {
    reasons.push("Integration tests must pass before promotion.");
  }

  if (qualitySignals.securityScan !== "passed") {
    reasons.push("Security scan must pass before promotion.");
  }

  if (qualitySignals.attestation !== "passed") {
    reasons.push("Artifact attestation is required before promotion.");
  }

  if (qualitySignals.signature !== "valid") {
    reasons.push("A valid signature is required before promotion.");
  }

  if (qualitySignals.coveragePct < coverageThresholdPct) {
    reasons.push(`Coverage must be at least ${coverageThresholdPct}%.`);
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    coverageThresholdPct,
  };
}

export function promoteCandidate(
  candidate: ReleaseCandidate,
  coverageThresholdPct: number,
  timestamp: string,
): { candidate: ReleaseCandidate; decision: PromotionDecision } {
  const decision = evaluatePromotion(candidate, coverageThresholdPct);

  if (!decision.allowed) {
    return {
      candidate: {
        ...candidate,
        updatedAt: timestamp,
        promotion: buildBlockedState(decision.reasons),
      },
      decision,
    };
  }

  return {
    candidate: {
      ...candidate,
      updatedAt: timestamp,
      promotion: {
        status: "promoted",
        reasons: [],
        promotedAt: timestamp,
      },
    },
    decision,
  };
}
