/**
 * Integrity checks for the archived chain data.
 *
 * Every check returns a list of problems; an empty list means it passed. The
 * hashing and tree-building come from the reader's own modules (js/merkle.mjs,
 * js/load.mjs) so the archive is judged by the same rules the site applies.
 */
import { gunzipSync } from "node:zlib";
import { readHeader } from "../../js/load.mjs";
import { merkle } from "../../js/merkle.mjs";
import { keccak_256 } from "../../js/vendor/noble-sha3.js";
import { keccak, toHex } from "./bytes.mjs";

const sum = (numbers) => numbers.reduce((total, n) => total + n, 0);

/** Cut `body` back into the chunks it was published as. */
function splitChunks(body, sizes) {
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

/** A ROM body against its merkle root, body hash, and inflated hash. */
export function checkRom(entry, body) {
  const { rom } = entry;
  const problems = [];

  if (rom.chunkSizes.length !== rom.chunkCount) {
    problems.push(`${rom.chunkSizes.length} chunk sizes recorded for ${rom.chunkCount} chunks`);
  }
  if (sum(rom.chunkSizes) !== body.length) {
    problems.push(`body is ${body.length} bytes, chunk sizes add up to ${sum(rom.chunkSizes)}`);
    return problems;
  }

  const leaves = splitChunks(body, rom.chunkSizes).map((chunk) => keccak_256(chunk));
  if (toHex(merkle(leaves).root) !== rom.root) problems.push("merkle root mismatch");
  if (keccak(body) !== rom.bodyHash) problems.push("body hash mismatch");

  let raw;
  try {
    raw = gunzipSync(body);
  } catch (error) {
    problems.push(`body does not inflate: ${error.message}`);
    return problems;
  }
  if (keccak(raw) !== rom.rawHash) problems.push("inflated hash mismatch");
  if (raw.length !== rom.rawBytes) {
    problems.push(`inflated to ${raw.length} bytes, manifest says ${rom.rawBytes}`);
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

  if (entry.rom) {
    const header = await readHeader(entry.address, rpc);
    const live = { root: header.root, bodyHash: header.bodyHash, rawHash: header.rawHash, rawBytes: header.rawBytes };
    for (const [field, value] of Object.entries(live)) {
      if (String(value).toLowerCase() !== String(entry.rom[field]).toLowerCase()) {
        problems.push(`on-chain ${field} differs from the archive`);
      }
    }
    if (!header.sealed) problems.push("ROM is no longer sealed");
  }
  return problems;
}
