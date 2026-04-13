import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createAppServer } from "../../src/app.js";

async function startServer() {
  const server = createAppServer({
    env: {
      APP_NAME: "container-app",
      APP_VERSION: "0.1.0",
      BUILD_TIMESTAMP: "2026-04-13T00:00:00.000Z",
      COVERAGE_THRESHOLD_PCT: "60",
      GIT_SHA: "deadbeef",
      IMAGE_TAG: "deadbeef",
      RULESET_IDS: "bootstrap-local-ci",
      WORKFLOW_NAME: "app-ci",
      WORKFLOW_REF: "local",
    },
    idGenerator: () => "candidate-fixed-id",
    now: () => "2026-04-13T00:00:00.000Z",
  });

  server.listen(0);
  await once(server, "listening");

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return { baseUrl, server };
}

test("GET /healthz returns ok", async (t) => {
  const { baseUrl, server } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/healthz`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: "ok" });
});

test("GET /version returns build metadata", async (t) => {
  const { baseUrl, server } = await startServer();
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/version`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.serviceName, "container-app");
  assert.equal(body.gitSha, "deadbeef");
  assert.equal(body.coverageThresholdPct, 60);
});

test("candidate lifecycle supports create, fetch, and promote", async (t) => {
  const { baseUrl, server } = await startServer();
  t.after(() => server.close());

  const createResponse = await fetch(`${baseUrl}/candidates`, {
    body: JSON.stringify({
      image: "ghcr.io/example/container-app:1.2.3",
      name: "candidate-a",
      version: "1.2.3",
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  const createdCandidate = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(createdCandidate.id, "candidate-fixed-id");

  const fetchResponse = await fetch(`${baseUrl}/candidates/candidate-fixed-id`);
  const fetchedCandidate = await fetchResponse.json();
  assert.equal(fetchResponse.status, 200);
  assert.equal(fetchedCandidate.name, "candidate-a");

  const promoteResponse = await fetch(`${baseUrl}/candidates/candidate-fixed-id/promote`, {
    method: "POST",
  });
  const promotedPayload = await promoteResponse.json();

  assert.equal(promoteResponse.status, 200);
  assert.equal(promotedPayload.decision.allowed, true);
  assert.equal(promotedPayload.candidate.promotion.status, "promoted");
});

test("promotion returns 409 when quality signals fail the gate", async (t) => {
  const { baseUrl, server } = await startServer();
  t.after(() => server.close());

  await fetch(`${baseUrl}/candidates`, {
    body: JSON.stringify({
      image: "ghcr.io/example/container-app:1.2.3",
      name: "candidate-b",
      qualitySignals: {
        attestation: "missing",
        coveragePct: 40,
        integrationTests: "failed",
        signature: "missing",
      },
      version: "1.2.3",
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  const promoteResponse = await fetch(`${baseUrl}/candidates/candidate-fixed-id/promote`, {
    method: "POST",
  });
  const blockedPayload = await promoteResponse.json();

  assert.equal(promoteResponse.status, 409);
  assert.equal(blockedPayload.decision.allowed, false);
  assert.ok(blockedPayload.decision.reasons.includes("Integration tests must pass before promotion."));
  assert.ok(blockedPayload.decision.reasons.includes("Coverage must be at least 60%."));
});
