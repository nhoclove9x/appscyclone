import { createHash } from "node:crypto";
import path from "node:path";

export function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function sourceFilenameFromPath(sourcePath: string): string {
  return path.basename(sourcePath);
}
