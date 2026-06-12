#!/usr/bin/env node
/**
 * Build file payloads for Supabase MCP deploy_edge_function.
 * Run: node scripts/deploy-email-functions.mjs
 */
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const FN_ROOT = join(ROOT, "supabase", "functions");

async function readFnFiles(fnName, extra = []) {
  const baseDir = join(FN_ROOT, fnName);
  const entries = await readdir(baseDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    files.push({
      name: `supabase/functions/${fnName}/${entry.name}`.replace(/\\/g, "/"),
      content: await readFile(join(baseDir, entry.name), "utf8"),
    });
  }
  for (const rel of extra) {
    files.push({
      name: `supabase/functions/${rel}`.replace(/\\/g, "/"),
      content: await readFile(join(FN_ROOT, rel), "utf8"),
    });
  }
  return files;
}

const processFiles = await readFnFiles("process-email-queue", ["_shared/send-email.ts"]);

const authFiles = [
  ...(await readFnFiles("auth-email-hook")),
  ...(await (async () => {
    const dir = join(FN_ROOT, "_shared", "email-templates");
    const entries = await readdir(dir, { withFileTypes: true });
    return Promise.all(
      entries
        .filter((e) => e.isFile())
        .map(async (e) => ({
          name: `supabase/functions/_shared/email-templates/${e.name}`,
          content: await readFile(join(dir, e.name), "utf8"),
        })),
    );
  })()),
];

console.log(JSON.stringify({ processFiles: processFiles.length, authFiles: authFiles.length }, null, 2));
await import("node:fs/promises").then((fs) =>
  fs.writeFile(
    join(ROOT, "scripts", "email-fn-deploy-payload.json"),
    JSON.stringify({ processFiles, authFiles }),
  ),
);
console.log("Wrote scripts/email-fn-deploy-payload.json");
