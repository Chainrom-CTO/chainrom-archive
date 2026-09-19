#!/usr/bin/env node
/**
 * Continuity check. Answers: is everything this project depends on still there?
 *
 *   chain   every archived contract still has the archived code, ROMs still sealed
 *   site    the live site is reachable (and how it differs from the archived source)
 *   domain  the registration is not lapsing
 *
 * A problem fails the run (exit 1). A note is information only.
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rpcOver } from "../js/load.mjs";
import { checkOnline } from "./lib/checks.mjs";
import { DOMAIN, DOMAIN_WARN_DAYS, SITE } from "./lib/registry.mjs";

const MANIFEST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "manifest.json");
const DAY_MS = 86_400_000;
const TIMEOUT_MS = 20_000;
const SITE_FILE = /\.(html|css|m?js)$/;

/* Some services (rdap.org) refuse requests that do not identify themselves. */
const USER_AGENT = "chainrom-archive-watch/0.1";

const get = (url) => fetch(url, {
  signal: AbortSignal.timeout(TIMEOUT_MS),
  redirect: "follow",
  headers: { "user-agent": USER_AGENT },
});
const git = (...args) => execFileSync("git", args, { maxBuffer: 16 * 1024 * 1024 });

async function checkChain() {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  const rpc = rpcOver(manifest.chain.rpc);
  const problems = [];
  for (const entry of manifest.contracts) {
    try {
      for (const problem of await checkOnline(entry, rpc)) problems.push(`${entry.id}: ${problem}`);
    } catch (error) {
      problems.push(`${entry.id}: chain unreachable (${error.message})`);
    }
  }
  return { problems, notes: [] };
}

/** The ref holding the pristine mirror: a local branch, or its remote copy in CI. */
function mirrorRef() {
  for (const ref of [SITE.mirrorRef, `origin/${SITE.mirrorRef}`]) {
    try {
      git("rev-parse", "--verify", "--quiet", ref);
      return ref;
    } catch {
      // try the next candidate
    }
  }
  throw new Error(`no ${SITE.mirrorRef} branch found`);
}

async function checkSite() {
  const problems = [];
  const notes = [];
  const ref = mirrorRef();
  const files = git("ls-tree", "-r", "--name-only", ref).toString().split("\n")
    .filter((file) => SITE_FILE.test(file) && !file.startsWith("js/vendor/"));

  for (const file of files) {
    let response;
    try {
      response = await get(`${SITE.origin}/${file}`);
    } catch (error) {
      problems.push(`site unreachable at /${file} (${error.message})`);
      break;
    }
    if (!response.ok) {
      const list = file === "index.html" ? problems : notes;
      list.push(`/${file} returned HTTP ${response.status}`);
      continue;
    }
    const live = Buffer.from(await response.arrayBuffer());
    if (!live.equals(git("show", `${ref}:${file}`))) notes.push(`/${file} differs from the archived source`);
  }
  return { problems, notes };
}

async function checkDomain(now = Date.now()) {
  let response;
  try {
    response = await get(`https://rdap.org/domain/${DOMAIN.name}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    return { problems: [], notes: [`RDAP lookup failed (${error.message}); domain not checked`] };
  }

  const record = await response.json();
  const expiry = record.events?.find((event) => event.eventAction === "expiration")?.eventDate;
  if (!expiry) return { problems: [], notes: ["RDAP record has no expiration date"] };

  const days = Math.floor((Date.parse(expiry) - now) / DAY_MS);
  const problems = days < DOMAIN_WARN_DAYS
    ? [`${DOMAIN.name} expires ${expiry.slice(0, 10)} (${days} days)`]
    : [];
  const notes = expiry.slice(0, 10) === DOMAIN.expires
    ? []
    : [`${DOMAIN.name} expiry is now ${expiry.slice(0, 10)}, archived as ${DOMAIN.expires}`];
  return { problems, notes };
}

async function main() {
  const checks = { chain: checkChain, site: checkSite, domain: checkDomain };
  let failed = false;
  for (const [name, run] of Object.entries(checks)) {
    /* A check that cannot run is itself a failure, and must not hide the others. */
    const { problems, notes } = await run().catch((error) => ({
      problems: [`check could not run: ${error.message}`],
      notes: [],
    }));
    console.log(`${problems.length ? "FAIL" : "ok  "} ${name}`);
    for (const problem of problems) console.log(`       - ${problem}`);
    for (const note of notes) console.log(`       . ${note}`);
    failed ||= problems.length > 0;
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
