import { createRequire } from "node:module";
import { mkdir, readdir, copyFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(path.join(root, "apps/app/package.json"));
const sharp = require("sharp");
const directory = path.join(root, "apps/app/public/warcraft");
const rawDirectory = path.join(root, ".diffui/raw");
await mkdir(rawDirectory, { recursive: true });
const files = (await readdir(directory)).filter((name) =>
  name.endsWith(".webp"),
);
for (const file of files) {
  const raw = path.join(rawDirectory, file);
  if (!existsSync(raw)) await copyFile(path.join(directory, file), raw);
}
const manifest = [];
for (const name of files.filter(
  (name) => !/-(height|normal|roughness)\./.test(name),
)) {
  const source = path.join(rawDirectory, name);
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width,
    top = info.height,
    right = 0,
    bottom = 0,
    transparent = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha < 10) transparent++;
      if (alpha > 32) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  left = Math.max(0, left - 2);
  top = Math.max(0, top - 2);
  right = Math.min(info.width - 1, right + 2);
  bottom = Math.min(info.height - 1, bottom + 2);
  if (name === "chain.webp")
    bottom = Math.min(bottom, top + Math.round((right - left + 1) * 4.2));
  const crop = { left, top, width: right - left + 1, height: bottom - top + 1 };
  const slug = name.slice(0, -5);
  for (const suffix of ["", "-normal", "-height", "-roughness"]) {
    const input = path.join(rawDirectory, `${slug}${suffix}.webp`);
    if (!existsSync(input)) continue;
    const meta = await sharp(input).metadata();
    const scaled = {
      left: Math.round((crop.left / info.width) * meta.width),
      top: Math.round((crop.top / info.height) * meta.height),
      width: Math.round((crop.width / info.width) * meta.width),
      height: Math.round((crop.height / info.height) * meta.height),
    };
    scaled.width = Math.min(scaled.width, meta.width - scaled.left);
    scaled.height = Math.min(scaled.height, meta.height - scaled.top);
    await sharp(input)
      .extract(scaled)
      .resize({
        width: Math.min(crop.width, slug === "backdrop" ? 1920 : 1400),
        withoutEnlargement: true,
      })
      .webp({ quality: 90, alphaQuality: 100 })
      .toFile(path.join(directory, `${slug}${suffix}.webp`));
  }
  manifest.push({
    asset: slug,
    source: "Diffui",
    originalSize: [info.width, info.height],
    crop,
    transparentShare: Number(
      (transparent / (info.width * info.height)).toFixed(3),
    ),
    maps: slug === "backdrop" ? [] : ["normal", "height", "roughness"],
  });
}
await writeFile(
  path.join(directory, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  manifest.map(({ asset, crop, transparentShare }) => ({
    asset,
    width: crop.width,
    height: crop.height,
    transparentShare,
  })),
);
