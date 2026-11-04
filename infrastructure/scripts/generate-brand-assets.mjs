import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const sharp = require("sharp");
const directory = new URL("../../apps/web/public/brand/", import.meta.url);
// Preserve the N drawn by the existing Brand component.
const path = "M4 25V5h6l10 20h6V5M4 5l22 20";
const svg = (icon) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none"><title>Nodra</title>${icon ? '<rect width="512" height="512" rx="112" fill="#533afd"/>' : ""}<g transform="translate(76 76) scale(12)"><path d="${path}" stroke="${icon ? "#ffffff" : "#061b31"}" stroke-width="1.5"/></g></svg>\n`;
await mkdir(directory, { recursive: true });
await writeFile(new URL("nodra-logo.svg", directory), svg(false));
await writeFile(new URL("nodra-icon.svg", directory), svg(true));
for (const [name, icon, size] of [
  ["nodra-logo.png", false, 1024],
  ["nodra-icon.png", true, 1024],
  ["nodra-app-icon.png", true, 1024],
  ["apple-touch-icon.png", true, 180],
  ["favicon-32.png", true, 32],
]) {
  let image = sharp(Buffer.from(svg(icon))).resize(size, size);
  if (name === "nodra-app-icon.png" || name === "apple-touch-icon.png")
    image = image.flatten({ background: "#533afd" });
  await image.png().toFile(fileURLToPath(new URL(name, directory)));
}
console.log("Nodra SVG and PNG assets generated in apps/web/public/brand.");
