#!/usr/bin/env node
/**
 * Record where the domain points and how it is registered, as public data.
 *
 *   snapshots/domain-<date>.json   DNS records and the RDAP registration record
 *
 * The domain is held by the original author, so this is evidence of its state
 * at a point in time, not something this project can preserve.
 * Usage: node scripts/capture-domain.mjs
 */
import { resolve } from "node:dns/promises";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOMAIN } from "./lib/registry.mjs";

const SNAPSHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "snapshots");
const RECORD_TYPES = ["A", "AAAA", "CNAME", "NS", "MX", "TXT"];
const NO_RECORDS = new Set(["ENODATA", "ENOTFOUND"]);
const USER_AGENT = "chainrom-archive-capture/0.1";
const TIMEOUT_MS = 30_000;

/** Records of one type, or an empty list when the name simply has none. */
async function lookup(name, type) {
  try {
    return await resolve(name, type);
  } catch (error) {
    if (NO_RECORDS.has(error.code)) return [];
    throw error;
  }
}

async function dnsRecords(name) {
  const entries = [];
  for (const type of RECORD_TYPES) entries.push([type, await lookup(name, type)]);
  return Object.fromEntries(entries);
}

async function rdapRecord(name) {
  const response = await fetch(`https://rdap.org/domain/${name}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
    headers: { "user-agent": USER_AGENT, accept: "application/rdap+json" },
  });
  if (!response.ok) throw new Error(`RDAP lookup for ${name} returned HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const capturedAt = new Date().toISOString();
  const names = [DOMAIN.name, `www.${DOMAIN.name}`];

  const dns = {};
  for (const name of names) dns[name] = await dnsRecords(name);

  const snapshot = { schema: 1, capturedAt, dns, rdap: await rdapRecord(DOMAIN.name) };
  await mkdir(SNAPSHOTS_DIR, { recursive: true });
  const target = path.join(SNAPSHOTS_DIR, `domain-${capturedAt.slice(0, 10)}.json`);
  await writeFile(target, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`wrote ${path.relative(process.cwd(), target)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
