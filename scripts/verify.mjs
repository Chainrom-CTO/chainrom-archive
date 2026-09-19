#!/usr/bin/env node
/**
 * Verify the archived chain data.
 *
 *   node scripts/verify.mjs            offline: files against the manifest
 *   node scripts/verify.mjs --online   also compare against the live chain
 *
 * Exits 1 if anything fails.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rpcOver } from "../js/load.mjs";
import { fromHex } from "./lib/bytes.mjs";
import { checkCode, checkOnline, checkRom } from "./lib/checks.mjs";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const isOnline = process.argv.includes("--online");

async function verifyEntry(entry, rpc) {
  const code = fromHex(await readFile(path.join(DATA_DIR, "bytecode", `${entry.id}.hex`), "utf8"));
  const problems = checkCode(entry, code);

  if (entry.rom) {
    const body = await readFile(path.join(DATA_DIR, "roms", `${entry.id}.body`));
    problems.push(...checkRom(entry, body));
  }
  if (rpc) problems.push(...(await checkOnline(entry, rpc)));
  return problems;
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(DATA_DIR, "manifest.json"), "utf8"));
  const rpc = isOnline ? rpcOver(manifest.chain.rpc) : null;

  let failures = 0;
  for (const entry of manifest.contracts) {
    const problems = await verifyEntry(entry, rpc);
    const status = problems.length ? "FAIL" : "ok  ";
    console.log(`${status} ${entry.id.padEnd(20)} ${entry.address}`);
    for (const problem of problems) console.log(`       - ${problem}`);
    failures += problems.length ? 1 : 0;
  }

  const scope = isOnline ? "offline and against the chain" : "offline";
  console.log(`\n${manifest.contracts.length - failures}/${manifest.contracts.length} verified ${scope}`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
