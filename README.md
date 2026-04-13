# Container App

This repository is intended to be a small, governed containerized application used to validate GitHub org rulesets, reusable workflows, attestation signing, and downstream verification behavior.

The goal of this app is not business functionality. The goal is to provide a predictable spoke repository that can prove the end-to-end control path described in the governance documents:

- Security-owned required workflows are injected and enforced.
- Platform-owned checks are injected and enforced.
- BU-owned reusable workflows handle build, test, coverage, and publish.
- Artifact provenance, signatures, SBOMs, and coverage evidence are generated and observable.
- Unsigned or non-compliant artifacts can be blocked before merge or deployment.

## Why This Repo Exists

This POC aligns to the governance patterns defined in the supporting docs:

- [Org governance](../Docs/0001-org-governance.md): required workflows, rulesets, and hub-and-spoke ownership model.
- [Standardization](../Docs/0002-standardization.md): versioned workflow templates and canary-style rollout.
- [Attestation](../Docs/0003-attestation.md): provenance, signing, and chain-of-evidence requirements.
- [Observability](../Docs/0003-observability.md): structured evidence and Grafana correlation.
- [Unified GitOps](../Docs/0004-unified-gitops.md): signed artifacts must be verified before deployment.
- [Quality gates](../Docs/0006-QualityGate-k8.md.md) and [thresholds](../Docs/0006-qualitygates/thresholds.md): coverage and test thresholds must feed the release decision.

This repo should be the simplest possible app that still exercises those controls in a realistic way.

## Recommended Tester App

The recommended implementation is a small Node.js 20 + TypeScript HTTP API with an in-memory store and no external database.

That is the best fit for this POC because it gives us:

- Fast builds and short feedback loops.
- Straightforward unit and integration testing.
- Easy coverage reporting in LCOV, Cobertura, and JUnit formats.
- A realistic dependency tree for SCA and container scanning.
- Simple Docker multi-stage builds.
- Low app complexity, so pipeline failures are easy to attribute to governance controls rather than application design.

## App Shape

The app should be a tiny release-candidate service with enough logic to create meaningful tests and coverage, but no infrastructure dependencies.

Suggested endpoints:

- `GET /healthz`: liveness probe.
- `GET /readyz`: readiness probe.
- `GET /version`: returns commit SHA, image tag, build timestamp, and workflow metadata passed via env vars.
- `POST /candidates`: creates a mock release candidate with validation rules.
- `GET /candidates/:id`: returns a stored candidate.
- `POST /candidates/:id/promote`: applies simple promotion rules such as required test status, required scan status, and required signature flag.

This keeps the application small while creating enough code branches to test:

- happy-path business logic
- input validation failures
- promotion gating logic
- structured logging
- container health behavior

## Target Repository Shape

This repo is currently a stub. The intended target structure is:

```text
Container-App/
├── .github/
│   └── workflows/
│       └── app-ci.yml              # Calls BU reusable workflow only
├── src/
│   ├── app.ts
│   ├── routes/
│   ├── services/
│   ├── domain/
│   └── telemetry/
├── test/
│   ├── unit/
│   └── integration/
├── coverage/
│   ├── lcov.info
│   ├── cobertura-coverage.xml
│   └── coverage-summary.json
├── reports/
│   └── junit.xml
├── artifacts/
│   ├── sbom.spdx.json
│   └── attestation-evidence.json
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

## Governance Model For This Repo

The tester app should prove the separation of duties described in the docs.

### Security-owned enforcement

Expected from the SecOps repo and GitHub org rulesets:

- secret scanning
- source vulnerability or SAST scanning
- container or dependency security scanning
- SBOM generation and signing
- artifact attestation generation
- cosign signing or equivalent signing control

These checks should be required and not editable from this repo.

### Platform-owned enforcement

Expected from the platform repo and GitHub org rulesets:

- linting
- policy-as-code validation
- baseline repository standards

These checks should also be required and not editable from this repo.

### BU-owned workflow behavior

Expected from this repo through a reusable workflow call:

- build the container image
- run unit tests
- run integration tests
- calculate code coverage
- publish test reports and coverage reports
- publish the image only after quality gates pass

The local workflow in this repo should stay thin and mainly pass parameters into the central reusable workflow.

## Coverage And Attestation

Coverage must be part of the chain of evidence for this POC.

Per the quality-gate docs, the baseline threshold should be:

- standard: coverage above 60%
- target: coverage above 80%

Recommended behavior:

1. The BU workflow runs tests and generates `coverage-summary.json`, `lcov.info`, and `junit.xml`.
2. The workflow computes the final coverage percentage and compares it to the configured threshold.
3. The workflow emits a signed evidence file before publish.
4. The SecOps signing workflow only signs or promotes the artifact when the quality gate passes.
5. The evidence is pushed into Grafana-compatible structured logs for auditability.

The key point is that coverage should not just be visible in a report. It should be attached to the same evidence trail as the image digest and attestation outcome.

Suggested evidence payload:

```json
{
	"repo": "Container-App",
	"commit_sha": "<git sha>",
	"image": "ghcr.io/<org>/container-app",
	"image_digest": "sha256:<digest>",
	"coverage_pct": 78.4,
	"coverage_threshold_pct": 60,
	"coverage_report_digest": "sha256:<digest>",
	"unit_tests_passed": 24,
	"integration_tests_passed": 6,
	"sbom_digest": "sha256:<digest>",
	"attestation_result": "passed",
	"signature_result": "passed",
	"signed_by_workflow": "secops/signing-workflow@v1"
}
```

If GitHub native attestation cannot carry all quality metadata directly, this file should still be generated, signed, and referenced by digest alongside the main provenance attestation.

## Observability Expectations

This app should emit structured evidence that can be correlated in Grafana Cloud using repo, commit, workflow run, environment, and artifact digest.

Minimum metadata to emit in workflow logs and evidence artifacts:

- `repo`
- `app`
- `environment`
- `commit_sha`
- `pr_id`
- `artifact_digest`
- `version`
- `pipeline_stage`
- `ruleset_ids`
- `coverage_pct`
- `attestation_result`
- `signature_result`

This gives a direct path from pull request to build to attestation to deployment verification.

## Test Scenarios This Repo Should Support

To make the repo useful for governance testing, it should intentionally support both passing and failing cases.

### Happy path

- all tests pass
- coverage is above threshold
- SBOM is generated
- attestation is created
- image is signed
- image is accepted by downstream verification

### Controlled failure cases

- coverage below threshold to confirm merge or publish block
- lint failure to confirm platform ruleset enforcement
- secret fixture committed to confirm security ruleset enforcement
- vulnerable dependency fixture to confirm SCA or PointGuard block
- missing attestation or invalid signature to confirm downstream rejection
- failing integration test to confirm BU workflow gating

The ideal pattern is to keep `main` green and use dedicated test branches or controlled feature flags to exercise the failing paths.

Suggested branch names for POC runs:

- `test/coverage-below-threshold`
- `test/lint-failure`
- `test/secret-detection`
- `test/vulnerable-dependency`
- `test/attestation-missing`
- `test/integration-failure`

## Container Requirements

The image should stay intentionally simple but production-like enough to validate policy behavior.

- multi-stage Docker build
- non-root runtime user
- pinned base image
- OCI labels for source, revision, version, and created timestamp
- health endpoint for probe validation
- deterministic build output where possible

The app should not depend on a database, queue, or cloud service for the POC. That would introduce noise into pipeline validation.

## POC Success Criteria

This repository is successful when it can demonstrate all of the following:

- GitHub org rulesets automatically inject and enforce security and platform controls.
- The local app workflow only orchestrates app-specific build and test behavior.
- Coverage is measured, thresholded, and included in the evidence chain.
- The final container image has both provenance attestation and a valid signature.
- Logs and evidence can be queried in Grafana by commit SHA and artifact digest.
- An unsigned or non-compliant image is blocked before or during deployment.

## Recommended Next Build Step

The first implementation should create only the minimum viable app needed to exercise the controls:

1. Build the small TypeScript API with unit and integration tests.
2. Add Dockerfile and coverage report generation.
3. Add the thin app workflow that calls the BU reusable workflow.
4. Wire in SecOps signing and attestation workflows through org rulesets.
5. Add one passing branch and one failing coverage branch to validate enforcement.

That gives a clean tester app for ruleset validation without overbuilding the application itself.
