#!/usr/bin/env node
/**
 * Run the site with no chain connection.
 *
 * Serves this repository over HTTP and answers the reader's JSON-RPC requests
 * from data/, so the unmodified site can boot the archived ROMs from the archive
 * alone. It implements only what the loader calls: eth_chainId, eth_getCode, and
 * eth_call for a ROM's read functions. The BATTLESHIP referee is live chain state
 * and is not emulated.
 *
 * Usage: node scripts/serve-offline.mjs [--port 8767]
 * Then open http://127.0.0.1:8767/index.html?rpc=/rpc
 */
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SIG } from "../js/load.mjs";
import { keccak_256 } from "../js/vendor/noble-sha3.js";
import { toHex } from "./lib/bytes.mjs";
import { chunkCode, splitChunks } from "./lib/checks.mjs";
import { CHAIN } from "./lib/registry.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const MAX_REQUEST_BYTES = 1024 * 1024;
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".pdf": "application/pdf",
};

const portFlag = process.argv.indexOf("--port");
const port = portFlag > -1 ? Number(process.argv[portFlag + 1]) : 8767;

const word = (value) => "0x" + BigInt(value).toString(16).padStart(64, "0");
const addressWord = (address) => "0x" + address.slice(2).padStart(64, "0");
const selectorOf = (signature) => toHex(keccak_256(new TextEncoder().encode(signature)).slice(0, 4));

/** Everything the reader can ask for, keyed by address, built from data/. */
async function loadArchive() {
  const manifest = JSON.parse(await readFile(path.join(ROOT, "data", "manifest.json"), "utf8"));
  const code = new Map();
  const roms = new Map();

  for (const entry of manifest.contracts) {
    code.set(entry.address, (await readFile(path.join(ROOT, "data", "bytecode", `${entry.id}.hex`), "utf8")).trim());
    if (!entry.rom) continue;

    const body = await readFile(path.join(ROOT, "data", "roms", `${entry.id}.body`));
    const chunks = splitChunks(body, entry.rom.chunks.map((chunk) => chunk.bytes));
    entry.rom.chunks.forEach((chunk, i) => code.set(chunk.address, toHex(chunkCode(chunks[i]))));
    roms.set(entry.address, entry.rom);
  }
  return { code, roms };
}

/** ABI-encoded answers to the ROM read functions the loader calls. */
function romCall(rom, data) {
  const selector = data.slice(0, 10);
  const answers = {
    [selectorOf(SIG.chunkCount)]: () => word(rom.chunkCount),
    [selectorOf(SIG.root)]: () => rom.root,
    [selectorOf(SIG.bodyHash)]: () => rom.bodyHash,
    [selectorOf(SIG.rawHash)]: () => rom.rawHash,
    [selectorOf(SIG.rawBytes)]: () => word(rom.rawBytes),
    [selectorOf(SIG.sealed)]: () => word(rom.sealed ? 1 : 0),
    [selectorOf(SIG.chunks)]: () => {
      const chunk = rom.chunks[Number(BigInt("0x" + data.slice(10, 74)))];
      if (!chunk) throw new Error("execution reverted");
      return addressWord(chunk.address);
    },
  };
  const answer = answers[selector];
  if (!answer) throw new Error("execution reverted");
  return answer();
}

function handleRpc(archive, { method, params }) {
  switch (method) {
    case "eth_chainId":
      return "0x" + CHAIN.id.toString(16);
    case "eth_getCode":
      return archive.code.get(params[0].toLowerCase()) ?? "0x";
    case "eth_call": {
      const rom = archive.roms.get(params[0].to.toLowerCase());
      if (!rom) throw new Error("execution reverted");
      return romCall(rom, params[0].data);
    }
    default:
      throw new Error(`archive server does not implement ${method}`);
  }
}

async function readBody(request) {
  const parts = [];
  let size = 0;
  for await (const part of request) {
    size += part.length;
    if (size > MAX_REQUEST_BYTES) throw new Error("request too large");
    parts.push(part);
  }
  return Buffer.concat(parts).toString("utf8");
}

async function serveRpc(archive, request, response) {
  const call = JSON.parse(await readBody(request));
  let reply;
  try {
    reply = { jsonrpc: "2.0", id: call.id, result: handleRpc(archive, call) };
  } catch (error) {
    console.error(`rpc ${call.method}: ${error.message}`);
    reply = { jsonrpc: "2.0", id: call.id, error: { code: -32000, message: error.message } };
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(reply));
}

async function serveFile(request, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${HOST}`).pathname);
  } catch {
    response.writeHead(400).end("bad request");
    return;
  }
  const target = path.join(ROOT, pathname.endsWith("/") ? `${pathname}index.html` : pathname);
  const isInsideRoot = target === ROOT || target.startsWith(ROOT + path.sep);
  const isHidden = pathname.split("/").some((segment) => segment.startsWith("."));
  if (pathname.includes("\0") || isHidden || !isInsideRoot || (await stat(target).catch(() => null))?.isFile() !== true) {
    response.writeHead(404).end("not found");
    return;
  }
  response.writeHead(200, { "content-type": CONTENT_TYPES[path.extname(target)] ?? "application/octet-stream" });
  response.end(request.method === "HEAD" ? undefined : await readFile(target));
}

async function main() {
  const archive = await loadArchive();
  const server = http.createServer((request, response) => {
    const handler = request.method === "POST" && request.url === "/rpc"
      ? serveRpc(archive, request, response)
      : request.method === "GET" || request.method === "HEAD"
        ? serveFile(request, response)
        : Promise.resolve(response.writeHead(405).end());
    handler.catch((error) => {
      console.error(error.message);
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  server.listen(port, HOST, () => {
    console.log(`serving the archive at http://${HOST}:${server.address().port}/index.html?rpc=/rpc`);
    console.log(`${archive.roms.size} ROMs and ${archive.code.size} contracts answer from data/; no chain connection is used`);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
