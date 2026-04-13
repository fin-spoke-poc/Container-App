import type { ReleaseCandidate } from "../domain/candidate.js";

export class CandidateStore {
  readonly #candidates = new Map<string, ReleaseCandidate>();

  get(id: string): ReleaseCandidate | undefined {
    return this.#candidates.get(id);
  }

  save(candidate: ReleaseCandidate): ReleaseCandidate {
    this.#candidates.set(candidate.id, candidate);
    return candidate;
  }
}

export function createCandidateStore(): CandidateStore {
  return new CandidateStore();
}
