import { readFile, writeFile, mkdir } from "node:fs/promises";

const packageJsonPath = new URL("../package.json", import.meta.url);
const outputPath = new URL("../artifacts/sbom.spdx.json", import.meta.url);

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const created = new Date().toISOString();

const document = {
  SPDXID: "SPDXRef-DOCUMENT",
  spdxVersion: "SPDX-2.3",
  dataLicense: "CC0-1.0",
  name: `${packageJson.name}-sbom`,
  documentNamespace: `https://poc.finastra.internal/spdx/${packageJson.name}/${packageJson.version}/${Date.now()}`,
  creationInfo: {
    created,
    creators: ["Tool: container-app-local-sbom-generator"],
  },
  packages: [
    {
      SPDXID: "SPDXRef-RootPackage",
      name: packageJson.name,
      versionInfo: packageJson.version,
      supplier: "NOASSERTION",
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
      licenseConcluded: "NOASSERTION",
      licenseDeclared: "NOASSERTION",
      primaryPackagePurpose: "APPLICATION",
      externalRefs: [
        {
          referenceCategory: "PACKAGE-MANAGER",
          referenceLocator: `pkg:npm/${packageJson.name}@${packageJson.version}`,
          referenceType: "purl",
        },
      ],
    },
  ],
  relationships: [
    {
      spdxElementId: "SPDXRef-DOCUMENT",
      relationshipType: "DESCRIBES",
      relatedSpdxElement: "SPDXRef-RootPackage",
    },
  ],
};

await mkdir(new URL("../artifacts", import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
