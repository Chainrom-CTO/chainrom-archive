#!/usr/bin/env node
/**
 * Boot every archived ROM with no chain connection.
 *
 * Starts scripts/serve-offline.mjs and runs the site's own loader (js/load.mjs)
 * against it for each ROM. The loader rebuilds the merkle tree, compares the
 * root, checks both hashes and inflates, exactly as the page does, so a pass
 * means the archive alone is enough to read every game.
 *
 * Exits 1 if any ROM fails.
 */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { loadRom, rpcOver } from "../js/load.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const START_TIMEOUT_MS = 10_000;

/** Start the archive server on a free port and resolve with that port. */
function startServer() {
  const child = spawn(process.execPath, [path.join(ROOT, "scripts", "serve-offline.mjs"), "--port", "0"], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("archive server did not start")), START_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => {
      const match = String(chunk).match(/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.on("exit", (code) => reject(new Error(`archive server exited with code ${code}`)));
  });
  return { child, ready };
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(ROOT, "data", "manifest.json"), "utf8"));
  const { child, ready } = startServer();
  let failures = 0;

  try {
    const rpc = rpcOver(`http://127.0.0.1:${await ready}/rpc`, { attempts: 1 });
    for (const entry of manifest.contracts.filter((contract) => contract.rom)) {
      try {
        const { bytes, chunkCount } = await loadRom(entry.address, rpc, { inflate: async (body) => gunzipSync(body) });
        if (bytes.length !== entry.rom.rawBytes) throw new Error(`inflated to ${bytes.length} bytes`);
        console.log(`ok   ${entry.id.padEnd(12)} ${chunkCount} chunks, ${bytes.length} bytes, verified by the reader`);
      } catch (error) {
        failures += 1;
        console.log(`FAIL ${entry.id.padEnd(12)} ${error.message}`);
      }
    }
  } finally {
    child.kill();
  }
  console.log(`\n${failures ? "boot check failed" : "all ROMs boot from the archive with no chain connection"}`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
