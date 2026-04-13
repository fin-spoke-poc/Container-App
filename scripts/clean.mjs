import { rm } from "node:fs/promises";

const targets = ["dist", "coverage", "reports", "artifacts"];

await Promise.all(
  targets.map((target) => rm(new URL(`../${target}`, import.meta.url), { force: true, recursive: true })),
);
