#!/usr/bin/env node
/**
 * Capture every contract the reader depends on into data/.
 *
 *   data/manifest.json          addresses, hashes, chunk layout, capture time
 *   data/roms/<id>.body         the gzip payload, chunks concatenated in order
 *   data/bytecode/<id>.hex      runtime bytecode of each contract
 *
 * Nothing is written unless it passes the same checks `npm run verify` applies.
 * Usage: node scripts/export-chain.mjs [--rpc <url>]
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readChunk, readHeader, readPointers, rpcOver } from "../js/load.mjs";
import { fromHex, keccak, toHex } from "./lib/bytes.mjs";
import { checkCode, checkRom } from "./lib/checks.mjs";
import { CHAIN, CONTRACTS } from "./lib/registry.mjs";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const OWNER_SELECTOR = "0x8da5cb5b"; // owner()

const rpcFlag = process.argv.indexOf("--rpc");
const rpc = rpcOver(rpcFlag > -1 ? process.argv[rpcFlag + 1] : CHAIN.rpc);

/** owner() if the contract has one; null if it reverts. Other failures propagate. */
async function readOwner(address) {
  try {
    const result = await rpc("eth_call", [{ to: address, data: OWNER_SELECTOR }, "latest"]);
    return result && result !== "0x" ? "0x" + result.slice(-40) : null;
  } catch (error) {
    if (/revert/i.test(error.message)) return null;
    throw error;
  }
}

async function captureRom(address) {
  const header = await readHeader(address, rpc);
  if (!header.sealed) throw new Error(`${address} is not sealed; its root can still change`);

  const pointers = await readPointers(address, header.chunkCount, rpc);
  const chunks = [];
  for (const pointer of pointers) chunks.push(await readChunk(pointer, rpc));

  return {
    body: Buffer.concat(chunks),
    rom: {
      root: header.root.toLowerCase(),
      bodyHash: header.bodyHash.toLowerCase(),
      rawHash: header.rawHash.toLowerCase(),
      rawBytes: header.rawBytes,
      chunkCount: header.chunkCount,
      chunkSizes: chunks.map((chunk) => chunk.length),
      pointers,
      sealed: true,
    },
  };
}

async function captureContract(contract) {
  const codeHex = await rpc("eth_getCode", [contract.address, "latest"]);
  if (codeHex === "0x") throw new Error(`no code at ${contract.address} (${contract.id})`);
  const code = fromHex(codeHex);

  const base = {
    id: contract.id,
    label: contract.label,
    role: contract.role,
    address: contract.address,
    owner: await readOwner(contract.address),
    codeBytes: code.length,
    codeHash: keccak(code),
  };
  const problems = checkCode(base, code);

  if (contract.role !== "rom") return { entry: base, code, body: null, problems };

  const { body, rom } = await captureRom(contract.address);
  const entry = { ...base, rom };
  return { entry, code, body, problems: [...problems, ...checkRom(entry, body)] };
}

async function main() {
  const chainId = Number(BigInt(await rpc("eth_chainId", [])));
  if (chainId !== CHAIN.id) throw new Error(`expected chain ${CHAIN.id}, endpoint reports ${chainId}`);
  const block = Number(BigInt(await rpc("eth_blockNumber", [])));

  const captures = [];
  for (const contract of CONTRACTS) {
    process.stdout.write(`capturing ${contract.id} ... `);
    const capture = await captureContract(contract);
    console.log(capture.problems.length ? "FAILED" : "ok");
    captures.push(capture);
  }

  const failed = captures.filter((capture) => capture.problems.length);
  if (failed.length) {
    for (const { entry, problems } of failed) console.error(`${entry.id}: ${problems.join("; ")}`);
    throw new Error("capture failed verification; nothing was written");
  }

  await mkdir(path.join(DATA_DIR, "roms"), { recursive: true });
  await mkdir(path.join(DATA_DIR, "bytecode"), { recursive: true });
  for (const { entry, code, body } of captures) {
    await writeFile(path.join(DATA_DIR, "bytecode", `${entry.id}.hex`), toHex(code) + "\n");
    if (body) await writeFile(path.join(DATA_DIR, "roms", `${entry.id}.body`), body);
  }

  const manifest = {
    schema: 1,
    chain: { id: CHAIN.id, name: CHAIN.name, rpc: CHAIN.rpc },
    capturedAt: new Date().toISOString(),
    capturedAtBlock: block,
    contracts: captures.map(({ entry }) => entry),
  };
  await writeFile(path.join(DATA_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`wrote ${captures.length} contracts at block ${block}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
