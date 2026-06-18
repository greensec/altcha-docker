import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const source = join(import.meta.dir, "..", "src", "demo", "index.html");
const destination = join(import.meta.dir, "..", "build", "demo", "index.html");
const altchaUrl = "https://cdn.jsdelivr.net/npm/altcha@3.1.0/dist/external/altcha.min.js";
const altchaDestination = join(import.meta.dir, "..", "build", "demo", "altcha.min.js");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);

const response = await fetch(altchaUrl);
if (!response.ok) throw new Error(`Failed to download altcha.min.js: ${response.status}`);
await writeFile(altchaDestination, Buffer.from(await response.arrayBuffer()));
