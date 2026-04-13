import assert from "node:assert/strict";
import test from "node:test";

import { createCandidate } from "../../src/domain/candidate.js";
import { evaluatePromotion } from "../../src/services/promotion-policy.js";

test("evaluatePromotion allows a fully compliant candidate", () => {
  const candidate = createCandidate(
    {
      name: "release-candidate",
      version: "1.2.3",
      image: "ghcr.io/example/release-candidate:1.2.3",
    },
    "2026-04-13T00:00:00.000Z",
    "candidate-1",
  );

  const decision = evaluatePromotion(candidate, 60);

  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.reasons, []);
});

test("evaluatePromotion blocks promotion when coverage is below threshold", () => {
  const candidate = createCandidate(
    {
      name: "coverage-failure",
      version: "1.2.3",
      image: "ghcr.io/example/coverage-failure:1.2.3",
      qualitySignals: {
        coveragePct: 42,
      },
    },
    "2026-04-13T00:00:00.000Z",
    "candidate-2",
  );

  const decision = evaluatePromotion(candidate, 60);

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes("Coverage must be at least 60%."));
});

test("evaluatePromotion blocks promotion when signature or attestation is missing", () => {
  const candidate = createCandidate(
    {
      name: "evidence-failure",
      version: "1.2.3",
      image: "ghcr.io/example/evidence-failure:1.2.3",
      qualitySignals: {
        attestation: "missing",
        signature: "missing",
      },
    },
    "2026-04-13T00:00:00.000Z",
    "candidate-3",
  );

  const decision = evaluatePromotion(candidate, 60);

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes("Artifact attestation is required before promotion."));
  assert.ok(decision.reasons.includes("A valid signature is required before promotion."));
});
