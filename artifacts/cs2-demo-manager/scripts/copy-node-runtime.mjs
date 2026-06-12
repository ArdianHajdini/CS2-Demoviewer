import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  process.exit(0);
}

const dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(dirname, "..");
const destination = path.join(projectRoot, "analyzer", "node.exe");

fs.copyFileSync(process.execPath, destination);
console.log(`Copied Node runtime to ${destination}`);
