import { cp, mkdir, lstat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../apps/web");
const standalone = resolve(root, ".next/standalone/apps/web");
if (!(await lstat(resolve(standalone, "server.js"))).isFile())
  throw new Error("Build the standalone web server before preparing assets.");
for (const [source, destination] of [
  [resolve(root, "public"), resolve(standalone, "public")],
  [resolve(root, ".next/static"), resolve(standalone, ".next/static")],
]) {
  const within = relative(root, destination);
  if (within.startsWith("..") || !within.startsWith(".next"))
    throw new Error("Standalone assets must stay inside the web workspace.");
  const target = await lstat(destination).catch(() => null);
  if (target?.isSymbolicLink())
    throw new Error("Refusing a linked asset destination.");
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}
console.log("Standalone public and static assets prepared.");
