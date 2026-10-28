import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? walk(join(path, e.name)) : [join(path, e.name)],
      ),
    )
  ).flat();
}
const files = await walk("src");
const mocks = [];
for (const file of files) {
  if (!/\.[jt]sx?$/.test(file)) continue;
  const text = await readFile(file, "utf8");
  if (text.includes("TEMP-MOCK:")) mocks.push(file);
}
console.log(
  mocks.length
    ? `Active TEMP-MOCK files:\n${mocks.join("\n")}`
    : "No active TEMP-MOCK handlers.",
);
