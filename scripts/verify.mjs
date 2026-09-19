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
import { checkCode, checkHistory, checkOnline, checkRom } from "./lib/checks.mjs";
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

  const body = entry.rom ? await readFile(path.join(DATA_DIR, "roms", `${entry.id}.body`)) : null;
  if (entry.rom) problems.push(...checkRom(entry, body), ...(await checkExtracted(entry)));

  const history = JSON.parse(await readFile(path.join(DATA_DIR, "history", `${entry.id}.json`), "utf8"));
  problems.push(...checkHistory(entry, history, body));

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

const ADDRESS = /^0x[0-9a-f]{40}$/;
const TX_HASH = /^0x[0-9a-f]{64}$/;

/**
 * Explorer records are third-party data that cannot be verified offline, so this
 * only checks that they describe the same contracts as the manifest and are
 * well-formed, which catches transcription mistakes.
 */
function checkExplorer(manifest, explorer, histories) {
  const addresses = new Map(manifest.contracts.map((entry) => [entry.id, entry.address]));
  const problems = [];
  for (const record of explorer.contracts) {
    if (addresses.get(record.id) !== record.address) problems.push(`${record.id}: address does not match the manifest`);
    if (!ADDRESS.test(record.creator)) problems.push(`${record.id}: creator is not a lowercase address`);
    if (!TX_HASH.test(record.creationTx)) problems.push(`${record.id}: creation transaction is not a lowercase hash`);

    const [creation] = histories.get(record.id)?.transactions ?? [];
    if (creation && (creation.hash !== record.creationTx || creation.from !== record.creationTxFrom || creation.to !== record.creationTxTo)) {
      problems.push(`${record.id}: differs from the recorded creation transaction`);
    }
  }
  const recorded = new Set(explorer.contracts.map((record) => record.id));
  for (const id of addresses.keys()) if (!recorded.has(id)) problems.push(`${id}: no explorer record`);
  return problems;
}

async function verifyExplorer(manifest) {
  let explorer;
  try {
    explorer = JSON.parse(await readFile(path.join(DATA_DIR, "explorer.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { total: 0, failures: 0 };
    throw error;
  }
  const histories = new Map();
  for (const { id } of manifest.contracts) {
    histories.set(id, JSON.parse(await readFile(path.join(DATA_DIR, "history", `${id}.json`), "utf8")));
  }
  const problems = checkExplorer(manifest, explorer, histories);
  console.log(`${problems.length ? "FAIL" : "ok  "} data/explorer.json  ${explorer.contracts.length} records`);
  for (const problem of problems) console.log(`       - ${problem}`);
  return { total: 1, failures: problems.length ? 1 : 0 };
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

  const explorer = await verifyExplorer(manifest);
  const snapshots = await verifySnapshots();
  const total = manifest.contracts.length + explorer.total + snapshots.total;
  failures += explorer.failures + snapshots.failures;

  const scope = isOnline ? "offline and against the chain" : "offline";
  console.log(`\n${total - failures}/${total} verified ${scope}`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
