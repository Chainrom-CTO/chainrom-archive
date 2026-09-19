/**
 * Integrity checks for the archived chain data.
 *
 * Every check returns a list of problems; an empty list means it passed. The
 * hashing and tree-building come from the reader's own modules (js/merkle.mjs,
 * js/load.mjs) so the archive is judged by the same rules the site applies.
 */
import { gunzipSync } from "node:zlib";
import { readHeader, readPointers } from "../../js/load.mjs";
import { merkle } from "../../js/merkle.mjs";
import { keccak_256 } from "../../js/vendor/noble-sha3.js";
import { keccak, toHex } from "./bytes.mjs";
import { bundleFiles, describeFiles } from "./extract.mjs";

/** A chunk contract's code is a STOP byte followed by the chunk. */
const STOP = Buffer.from([0x00]);
export const chunkCode = (chunk) => Buffer.concat([STOP, chunk]);

const sum = (numbers) => numbers.reduce((total, n) => total + n, 0);

/** Cut `body` back into the chunks it was published as. */
export function splitChunks(body, sizes) {
  const offsets = sizes.map((_, i) => sum(sizes.slice(0, i)));
  return sizes.map((size, i) => body.subarray(offsets[i], offsets[i] + size));
}

/** Runtime bytecode against the hash and length recorded for it. */
export function checkCode(entry, code) {
  const problems = [];
  if (code.length !== entry.codeBytes) {
    problems.push(`bytecode is ${code.length} bytes, manifest says ${entry.codeBytes}`);
  }
  if (keccak(code) !== entry.codeHash) problems.push("bytecode hash mismatch");
  return problems;
}

/** Each chunk's size, leaf hash and chunk-contract code hash; returns the leaves. */
function checkChunks(rom, body) {
  const problems = [];
  const chunks = splitChunks(body, rom.chunks.map((chunk) => chunk.bytes));
  chunks.forEach((chunk, i) => {
    const recorded = rom.chunks[i];
    if (keccak(chunk) !== recorded.leafHash) problems.push(`chunk ${i}: leaf hash mismatch`);
    if (keccak(chunkCode(chunk)) !== recorded.codeHash) problems.push(`chunk ${i}: contract code hash mismatch`);
  });
  return { problems, leaves: chunks.map((chunk) => keccak_256(chunk)) };
}

/** The files inside the inflated payload against the manifest's file list. */
function checkBundle(rom, raw) {
  let files;
  try {
    files = describeFiles(bundleFiles(raw));
  } catch (error) {
    return [`payload is not a valid bundle: ${error.message}`];
  }
  const recorded = rom.bundle.files;
  if (files.length !== recorded.length) {
    return [`bundle holds ${files.length} files, manifest lists ${recorded.length}`];
  }
  return files.flatMap((file, i) => {
    const same = file.name === recorded[i].name && file.bytes === recorded[i].bytes && file.sha256 === recorded[i].sha256;
    return same ? [] : [`bundle file ${i} (${file.name}) differs from the manifest`];
  });
}

/** A ROM body against its merkle root, body hash, inflated hash and file list. */
export function checkRom(entry, body) {
  const { rom } = entry;
  const sizes = rom.chunks.map((chunk) => chunk.bytes);

  if (sizes.length !== rom.chunkCount) {
    return [`${sizes.length} chunks recorded for a chunk count of ${rom.chunkCount}`];
  }
  if (sum(sizes) !== body.length) {
    return [`body is ${body.length} bytes, chunk sizes add up to ${sum(sizes)}`];
  }

  const { problems: chunkProblems, leaves } = checkChunks(rom, body);
  const problems = [...chunkProblems];
  if (toHex(merkle(leaves).root) !== rom.root) problems.push("merkle root mismatch");
  if (keccak(body) !== rom.bodyHash) problems.push("body hash mismatch");

  let raw;
  try {
    raw = gunzipSync(body);
  } catch (error) {
    return [...problems, `body does not inflate: ${error.message}`];
  }
  if (keccak(raw) !== rom.rawHash) problems.push("inflated hash mismatch");
  if (raw.length !== rom.rawBytes) {
    problems.push(`inflated to ${raw.length} bytes, manifest says ${rom.rawBytes}`);
  }
  return [...problems, ...checkBundle(rom, raw)];
}

/** Chunk contracts on the chain: same order, same code as archived. */
async function checkChunkContracts(entry, rpc) {
  const { rom } = entry;
  const problems = [];
  const pointers = await readPointers(entry.address, rom.chunkCount, rpc);
  rom.chunks.forEach((chunk, i) => {
    if (pointers[i].toLowerCase() !== chunk.address) problems.push(`chunk ${i}: on-chain pointer differs from the archive`);
  });
  for (const [i, chunk] of rom.chunks.entries()) {
    const codeHex = await rpc("eth_getCode", [chunk.address, "latest"]);
    if (keccak(Buffer.from(codeHex.slice(2), "hex")) !== chunk.codeHash) {
      problems.push(`chunk ${i}: on-chain code differs from the archive`);
    }
  }
  return problems;
}

/** What the chain says right now, against what was archived. */
export async function checkOnline(entry, rpc) {
  const problems = [];

  const codeHex = await rpc("eth_getCode", [entry.address, "latest"]);
  if (codeHex === "0x") return ["no code at this address"];
  if (keccak(Buffer.from(codeHex.slice(2), "hex")) !== entry.codeHash) {
    problems.push("on-chain bytecode differs from the archived copy");
  }
  if (!entry.rom) return problems;

  const header = await readHeader(entry.address, rpc);
  const live = { root: header.root, bodyHash: header.bodyHash, rawHash: header.rawHash, rawBytes: header.rawBytes };
  for (const [field, value] of Object.entries(live)) {
    if (String(value).toLowerCase() !== String(entry.rom[field]).toLowerCase()) {
      problems.push(`on-chain ${field} differs from the archive`);
    }
  }
  if (!header.sealed) problems.push("ROM is no longer sealed");
  return [...problems, ...(await checkChunkContracts(entry, rpc))];
}
