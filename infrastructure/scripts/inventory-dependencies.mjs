import { readFileSync, readdirSync, realpathSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const workspaces = [join(root, "package.json")];
for (const folder of ["apps", "packages"]) {
  for (const entry of readdirSync(join(root, folder), {
    withFileTypes: true,
  })) {
    const manifest = join(root, folder, entry.name, "package.json");
    if (entry.isDirectory() && existsSync(manifest)) workspaces.push(manifest);
  }
}
const owned = new Set(workspaces.map((path) => realpathSync(path)));
const visited = new Set();
const packages = [];
const missing = [];

function findManifest(from, name) {
  const paths = createRequire(from).resolve.paths(`${name}/package.json`) ?? [];
  for (const directory of paths) {
    const manifest = join(directory, name, "package.json");
    if (existsSync(manifest)) return realpathSync(manifest);
  }
  return null;
}

function visit(manifest) {
  manifest = realpathSync(manifest);
  if (visited.has(manifest)) return;
  visited.add(manifest);
  const data = json(manifest);
  const workspace = owned.has(manifest);
  const location = relative(root, dirname(manifest)).replaceAll("\\", "/");
  if (!workspace) {
    const metadata = data.license ?? data.licenses;
    const license =
      typeof metadata === "string"
        ? metadata
        : Array.isArray(metadata)
          ? metadata
              .map((item) => (typeof item === "string" ? item : item.type))
              .join(" OR ")
          : (metadata?.type ?? "UNDECLARED");
    packages.push({
      name: data.name,
      version: data.version,
      license,
      location,
      licenseFiles: readdirSync(dirname(manifest)).filter((name) =>
        /^(licen[cs]e|copying|notice)(\.|$)/i.test(name),
      ),
    });
  }
  const dependencies = {
    ...(workspace ? data.devDependencies : {}),
    ...data.peerDependencies,
    ...data.dependencies,
    ...data.optionalDependencies,
  };
  for (const name of Object.keys(dependencies).sort()) {
    const target = findManifest(manifest, name);
    if (target) visit(target);
    else
      missing.push({
        from: `${data.name}@${data.version}`,
        dependency: name,
        optional:
          Object.hasOwn(data.optionalDependencies ?? {}, name) ||
          data.peerDependenciesMeta?.[name]?.optional === true,
      });
  }
}

for (const workspace of workspaces) visit(workspace);
packages.sort(
  (a, b) =>
    a.name.localeCompare(b.name) ||
    a.version.localeCompare(b.version) ||
    a.location.localeCompare(b.location),
);
const licenses = {};
for (const item of packages)
  licenses[item.license] = (licenses[item.license] ?? 0) + 1;
const report = {
  node: process.version,
  declaredPackageManager: json(workspaces[0]).packageManager,
  lockfileSha256: createHash("sha256")
    .update(
      readFileSync(join(root, "pnpm-lock.yaml"), "utf8").replaceAll(
        "\r\n",
        "\n",
      ),
    )
    .digest("hex"),
  workspaces: workspaces.map(
    (path) => relative(root, dirname(path)).replaceAll("\\", "/") || ".",
  ),
  summary: {
    installedPackages: packages.length,
    licenses,
    missingRequired: missing.filter((item) => !item.optional).length,
    missingOptional: missing.filter((item) => item.optional).length,
    undeclaredLicense: packages.filter((item) => item.license === "UNDECLARED")
      .length,
  },
  packages,
  missing,
};
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--json")) {
  process.stderr.write(
    "Usage: node infrastructure/scripts/inventory-dependencies.mjs [--json]\n",
  );
  process.exitCode = 2;
} else {
  process.stdout.write(
    JSON.stringify(
      args.includes("--json")
        ? report
        : {
            ...report.summary,
            note: "Installed Node metadata only. Optional platform packages, Flutter, native binaries and image licenses require separate review. Use --json for details. This is not a legal or security certification.",
          },
      null,
      2,
    ) + "\n",
  );
  if (report.summary.missingRequired) process.exitCode = 1;
}
