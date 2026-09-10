import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(path.join(root, "apps/app/package.json"));
const sharp = require("sharp");
const source = path.join(root, ".diffui/classic");
const menuSource = path.join(root, ".diffui/classic-menu");
const destination = path.join(root, "apps/app/public/warcraft");
const regions = {
  "classic-header": { left: 0, top: 0, width: 1920, height: 172 },
  "classic-left": { left: 0, top: 0, width: 560, height: 1088 },
  "classic-main": { left: 560, top: 0, width: 1360, height: 1088 },
  "classic-menu": { left: 0, top: 0, width: 1920, height: 1088 },
};
const chainRegions = [
  [94, 116, 39, 56],
  [404, 91, 40, 81],
  [565, 95, 41, 77],
  [1277, 90, 33, 82],
  [1693, 0, 43, 130],
  [1654, 120, 127, 52],
];
const menuChainRegions = [
  [98, 125, 45, 47],
  [579, 123, 46, 49],
  [1293, 125, 46, 47],
  [1697, 0, 40, 172],
];
function maskFor(name, region) {
  const selected =
    name === "classic-menu"
      ? menuChainRegions
      : chainRegions.filter(([x]) =>
          name === "classic-left" ? x < 560 : x >= 560,
        );
  const body = `<rect x="0" y="172" width="${region.width}" height="916" fill="white"/>`;
  const chains = selected
    .map(
      ([x, y, width, height]) =>
        `<rect x="${x - region.left}" y="${y}" width="${width}" height="${height}" fill="white"/>`,
    )
    .join("");
  const header = `<rect width="1680" height="128" fill="white"/><rect x="1752" width="168" height="128" fill="white"/><rect width="132" height="151" fill="white"/><rect x="1780" width="140" height="151" fill="white"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${region.width}" height="${region.height}">${name === "classic-header" ? header : body + chains}</svg>`,
  );
}
await mkdir(destination, { recursive: true });
for (const [name, region] of Object.entries(regions)) {
  const frameSource =
    name === "classic-header" || name === "classic-menu" ? menuSource : source;
  for (const map of ["art", "normal", "height", "roughness"]) {
    const suffix = map === "art" ? "" : `-${map}`;
    const crop = await sharp(path.join(frameSource, `${map}.webp`))
      .resize(1920, 1088, { fit: "fill" })
      .extract(region)
      .toBuffer();
    await sharp(crop)
      .composite(
        map === "art"
          ? [{ input: maskFor(name, region), blend: "dest-in" }]
          : [],
      )
      .webp({ quality: 94, alphaQuality: 100 })
      .toFile(path.join(destination, `${name}${suffix}.webp`));
  }
}
await writeFile(
  path.join(destination, "classic-manifest.json"),
  JSON.stringify(
    {
      width: 1920,
      height: 1088,
      source: "New Diffui generation based on the supplied reference",
      maps: ["normal", "height", "roughness"],
      regions,
      chainRegions,
      menuChainRegions,
    },
    null,
    2,
  ) + "\n",
);
const iconNames = [
  "plus",
  "wrench",
  "folder",
  "gear",
  "sword",
  "scroll",
  "send",
  "chat",
  "user",
  "bug",
  "chart",
  "package",
];
const iconSource = path.join(root, ".diffui/classic-icons");
const iconBounds = {};
for (const [index, name] of iconNames.entries()) {
  const cell = {
    left: (index % 4) * 512,
    top: Math.floor(index / 4) * 512,
    width: 512,
    height: 512,
  };
  const { data, info } = await sharp(path.join(iconSource, "art.webp"))
    .resize(2048, 1536, { fit: "fill" })
    .extract(cell)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = 511,
    y0 = 511,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++)
      if (data[(y * 512 + x) * info.channels + 3] > 32) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  x0 = Math.max(0, x0 - 4);
  y0 = Math.max(0, y0 - 4);
  x1 = Math.min(511, x1 + 4);
  y1 = Math.min(511, y1 + 4);
  const crop = {
    left: cell.left + x0,
    top: cell.top + y0,
    width: x1 - x0 + 1,
    height: y1 - y0 + 1,
  };
  iconBounds[name] = crop;
  for (const map of ["art", "normal", "height", "roughness"]) {
    const pixels = await sharp(path.join(iconSource, `${map}.webp`))
      .resize(2048, 1536, { fit: "fill" })
      .extract(crop)
      .toBuffer();
    await sharp(pixels)
      .resize({ width: 192, height: 192, fit: "inside" })
      .webp({ quality: 94, alphaQuality: 100 })
      .toFile(
        path.join(
          destination,
          `classic-${name}${map === "art" ? "" : "-" + map}.webp`,
        ),
      );
  }
}
await writeFile(
  path.join(destination, "classic-icons-manifest.json"),
  JSON.stringify(
    {
      source: "New Diffui icon atlas",
      width: 2048,
      height: 1536,
      icons: iconBounds,
    },
    null,
    2,
  ) + "\n",
);
