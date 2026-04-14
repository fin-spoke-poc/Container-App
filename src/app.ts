import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { createCandidate } from "./domain/candidate.js";
import { createCandidateStore, type CandidateStore } from "./services/candidate-store.js";
import { promoteCandidate } from "./services/promotion-policy.js";
import { getBuildMetadata, type EnvMap } from "./telemetry/build-metadata.js";
import { logEvent } from "./telemetry/logger.js";

export interface AppDependencies {
  env?: EnvMap;
  store?: CandidateStore;
  now?: () => string;
  idGenerator?: () => string;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(body)}\n`);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    throw new Error("Request body is required.");
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function createUrl(request: IncomingMessage): URL {
  return new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
}

function decodeRouteParam(match: RegExpMatchArray, index: number): string {
  const value = match[index];

  if (value === undefined) {
    throw new Error("Route parameter is required.");
  }

  return decodeURIComponent(value);
}

export function createAppServer(dependencies: AppDependencies = {}): Server {
  const store = dependencies.store ?? createCandidateStore();
  const env = dependencies.env ?? process.env;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const idGenerator = dependencies.idGenerator ?? (() => randomUUID());
  const buildMetadata = getBuildMetadata(env);

  return createServer(async (request, response) => {
    const method = request.method ?? "GET";
    const url = createUrl(request);

    try {
      if (method === "GET" && url.pathname === "/healthz") {
        return sendJson(response, 200, { status: "ok" });
      }

      if (method === "GET" && url.pathname === "/readyz") {
        return sendJson(response, 200, { status: "ready" });
      }

      if (method === "GET" && url.pathname === "/version") {
        return sendJson(response, 200, buildMetadata);
      }

      if (method === "POST" && url.pathname === "/candidates") {
        const payload = await readJsonBody(request);
        const candidate = createCandidate(payload, now(), idGenerator());
        store.save(candidate);
        logEvent("info", "candidate_created", {
          candidateId: candidate.id,
          coveragePct: candidate.qualitySignals.coveragePct,
          image: candidate.image,
        });

        return sendJson(response, 201, candidate);
      }

      const candidateMatch = url.pathname.match(/^\/candidates\/([^/]+)$/);
      if (method === "GET" && candidateMatch) {
        const candidateId = decodeRouteParam(candidateMatch, 1);
        const candidate = store.get(candidateId);

        if (!candidate) {
          return sendJson(response, 404, { error: "Candidate not found." });
        }

        return sendJson(response, 200, candidate);
      }

      const promoteMatch = url.pathname.match(/^\/candidates\/([^/]+)\/promote$/);
      if (method === "POST" && promoteMatch) {
        const candidateId = decodeRouteParam(promoteMatch, 1);
        const candidate = store.get(candidateId);

        if (!candidate) {
          return sendJson(response, 404, { error: "Candidate not found." });
        }

        const promotionResult = promoteCandidate(candidate, buildMetadata.coverageThresholdPct, now());
        store.save(promotionResult.candidate);

        logEvent(promotionResult.decision.allowed ? "info" : "warn", "candidate_promoted", {
          allowed: promotionResult.decision.allowed,
          candidateId,
          reasons: promotionResult.decision.reasons,
        });

        return sendJson(response, promotionResult.decision.allowed ? 200 : 409, {
          candidate: promotionResult.candidate,
          decision: promotionResult.decision,
        });
      }

      return sendJson(response, 404, { error: "Route not found." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      logEvent("error", "request_failed", {
        method,
        path: url.pathname,
        message,
      });
      return sendJson(response, 400, { error: message });
    }
  });
}
