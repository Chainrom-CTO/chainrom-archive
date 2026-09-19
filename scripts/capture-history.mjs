#!/usr/bin/env node
/**
 * Capture how each contract was created and set up, as the chain recorded it.
 *
 *   data/history/<id>.json   the creation transaction and, for a ROM, every
 *                            transaction that emitted one of its events
 *                            (chunk uploads, seal), with full input and receipt
 *
 * The creation transaction's input is the init code, so with these records a
 * deployment can be replayed rather than approximated from final bytecode.
 * Reads the creation transaction hashes from data/explorer.json.
 * Usage: node scripts/capture-history.mjs [--rpc <url>]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rpcOver } from "../js/load.mjs";
import { fromHex, keccak } from "./lib/bytes.mjs";
import { CHAIN, CONTRACTS } from "./lib/registry.mjs";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");

const rpcFlag = process.argv.indexOf("--rpc");
const rpc = rpcOver(rpcFlag > -1 ? process.argv[rpcFlag + 1] : CHAIN.rpc);

const toNumber = (hex) => Number(BigInt(hex));
const toHexQuantity = (n) => "0x" + n.toString(16);

async function readTransaction(hash) {
  const [tx, receipt] = await Promise.all([
    rpc("eth_getTransactionByHash", [hash]),
    rpc("eth_getTransactionReceipt", [hash]),
  ]);
  if (!tx || !receipt) throw new Error(`transaction ${hash} not found`);
  return {
    hash: tx.hash,
    blockNumber: toNumber(tx.blockNumber),
    transactionIndex: toNumber(tx.transactionIndex),
    type: toNumber(tx.type),
    from: tx.from,
    to: tx.to,
    nonce: toNumber(tx.nonce),
    value: BigInt(tx.value).toString(),
    gas: toNumber(tx.gas),
    gasUsed: toNumber(receipt.gasUsed),
    status: toNumber(receipt.status),
    contractAddress: receipt.contractAddress,
    inputBytes: (tx.input.length - 2) / 2,
    inputHash: keccak(fromHex(tx.input)),
    input: tx.input,
    logs: receipt.logs.map((log) => ({ logIndex: toNumber(log.logIndex), address: log.address, topics: log.topics, data: log.data })),
  };
}

/** Hashes of every transaction that emitted an event from `address` since `fromBlock`. */
async function eventTransactionHashes(address, fromBlock, toBlock) {
  const logs = await rpc("eth_getLogs", [{ address, fromBlock: toHexQuantity(fromBlock), toBlock: toHexQuantity(toBlock) }]);
  return [...new Set(logs.map((log) => log.transactionHash))];
}

async function captureHistory(contract, explorer) {
  const created = explorer.contracts.find((record) => record.id === contract.id);
  if (!created) throw new Error(`no explorer record for ${contract.id}; run the explorer capture first`);

  const hashes = [created.creationTx];
  if (contract.role === "rom") {
    const latest = toNumber(await rpc("eth_blockNumber", []));
    hashes.push(...(await eventTransactionHashes(contract.address, created.creationBlock, latest)));
  }

  const transactions = [];
  for (const hash of [...new Set(hashes)]) transactions.push(await readTransaction(hash));
  transactions.sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex);

  return { id: contract.id, address: contract.address, chainId: CHAIN.id, transactions };
}

async function main() {
  const explorer = JSON.parse(await readFile(path.join(DATA_DIR, "explorer.json"), "utf8"));
  await mkdir(path.join(DATA_DIR, "history"), { recursive: true });

  for (const contract of CONTRACTS) {
    process.stdout.write(`history ${contract.id} ... `);
    const history = await captureHistory(contract, explorer);
    await writeFile(path.join(DATA_DIR, "history", `${contract.id}.json`), JSON.stringify(history, null, 2) + "\n");
    console.log(`${history.transactions.length} transactions`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
