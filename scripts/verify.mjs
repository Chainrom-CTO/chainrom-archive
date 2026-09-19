#!/usr/bin/env node
/**
 * Verify the archived chain data.
 *
 *   node scripts/verify.mjs            offline: files against the manifest
 *   node scripts/verify.mjs --online   also compare against the live chain
 *
 * Exits 1 if anything fails.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rpcOver } from "../js/load.mjs";
import { fromHex } from "./lib/bytes.mjs";
import { checkCode, checkOnline, checkRom } from "./lib/checks.mjs";
import { sha256 } from "./lib/extract.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const SNAPSHOTS_DIR = path.join(ROOT, "snapshots");
const isOnline = process.argv.includes("--online");

/** The extracted files on disk against the manifest's names, sizes and hashes. */
async function checkExtracted(entry) {
  const problems = [];
  for (const file of entry.rom.bundle.files) {
    let bytes;
    try {
      bytes = await readFile(path.join(DATA_DIR, "extracted", entry.id, file.name));
    } catch (error) {
      problems.push(`extracted file ${file.name} unreadable: ${error.code ?? error.message}`);
      continue;
    }
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) {
      problems.push(`extracted file ${file.name} differs from the manifest`);
    }
  }
  return problems;
}

async function verifyEntry(entry, rpc) {
  const code = fromHex(await readFile(path.join(DATA_DIR, "bytecode", `${entry.id}.hex`), "utf8"));
  const problems = checkCode(entry, code);

  if (entry.rom) {
    const body = await readFile(path.join(DATA_DIR, "roms", `${entry.id}.body`));
    problems.push(...checkRom(entry, body), ...(await checkExtracted(entry)));
  }
  if (rpc) problems.push(...(await checkOnline(entry, rpc)));
  return problems;
}

/** Each saved site file against the size and sha256 recorded when it was captured. */
async function verifySnapshot(directory) {
  const capture = JSON.parse(await readFile(path.join(SNAPSHOTS_DIR, directory, "capture.json"), "utf8"));
  const problems = [];
  for (const file of capture.files.filter((entry) => entry.status === 200)) {
    let bytes;
    try {
      bytes = await readFile(path.join(SNAPSHOTS_DIR, directory, file.path));
    } catch (error) {
      problems.push(`${file.path} unreadable: ${error.code ?? error.message}`);
      continue;
    }
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) problems.push(`${file.path} differs from capture.json`);
  }
  return { count: capture.files.filter((entry) => entry.status === 200).length, problems };
}

async function verifySnapshots() {
  const directories = (await readdir(SNAPSHOTS_DIR, { withFileTypes: true }).catch(() => []))
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  let failures = 0;
  for (const directory of directories) {
    const { count, problems } = await verifySnapshot(directory);
    console.log(`${problems.length ? "FAIL" : "ok  "} snapshots/${directory}  ${count} files`);
    for (const problem of problems) console.log(`       - ${problem}`);
    failures += problems.length ? 1 : 0;
  }
  return { total: directories.length, failures };
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(DATA_DIR, "manifest.json"), "utf8"));
  const rpc = isOnline ? rpcOver(manifest.chain.rpc) : null;

  let failures = 0;
  for (const entry of manifest.contracts) {
    const problems = await verifyEntry(entry, rpc);
    const status = problems.length ? "FAIL" : "ok  ";
    const detail = entry.rom ? `  ${entry.rom.chunkCount} chunks, ${entry.rom.bundle.files.length} files` : "";
    console.log(`${status} ${entry.id.padEnd(20)} ${entry.address}${detail}`);
    for (const problem of problems) console.log(`       - ${problem}`);
    failures += problems.length ? 1 : 0;
  }

  const snapshots = await verifySnapshots();
  const total = manifest.contracts.length + snapshots.total;
  failures += snapshots.failures;

  const scope = isOnline ? "offline and against the chain" : "offline";
  console.log(`\n${total - failures}/${total} verified ${scope}`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
