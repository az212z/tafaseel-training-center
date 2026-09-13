import sharp from "sharp";
import { readdir } from "node:fs/promises";
for (const folder of ["public/brand", "public/images"]) {
  const images = (await readdir(folder)).filter((name) => /\.jpg$/.test(name));
  for (const name of images) {
    const output = `${folder}/${name.replace(/\.jpg$/, ".webp")}`;
    const result = await sharp(`${folder}/${name}`)
      .webp({ quality: folder.endsWith("brand") ? 94 : 85 })
      .toFile(output);
    console.log(output, result.size);
  }
}
