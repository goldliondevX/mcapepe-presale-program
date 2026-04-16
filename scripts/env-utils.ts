/**
 * Load repo `.env` into `process.env` (only sets keys that are missing or empty).
 * Yarn does not load `.env` automatically.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function expandPath(p: string): string {
  const trimmed = p.trim();
  if (trimmed.startsWith("~/")) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  if (trimmed === "~") {
    return os.homedir();
  }
  return trimmed;
}

export type LoadEnvOptions = { overwrite?: boolean };

/**
 * @param overwrite - if true, values from `.env` replace existing `process.env` (recommended for deploy scripts so repo `.env` wins over stale shell exports).
 */
export function loadProjectEnv(
  projectRoot: string,
  opts?: LoadEnvOptions,
): void {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }
  const text = fs.readFileSync(envPath, "utf-8");
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#")) {
      continue;
    }
    const eq = s.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    const cur = process.env[key];
    if (opts?.overwrite || cur === undefined || cur === "") {
      process.env[key] = val;
    }
  }
}

export function defaultWalletPath(): string {
  return path.join(os.homedir(), ".config/solana/deployer.json");
}
