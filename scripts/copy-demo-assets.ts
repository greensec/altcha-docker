import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = join(import.meta.dir, "..");

const source = join(root, "src", "demo", "index.html");
const destination = join(root, "build", "demo", "index.html");
const altchaSource = join(root, "node_modules", "altcha", "dist", "external", "altcha.min.js");
const altchaDestination = join(root, "build", "demo", "altcha.min.js");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
await copyFile(altchaSource, altchaDestination);
