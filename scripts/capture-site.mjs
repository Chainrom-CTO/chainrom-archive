#!/usr/bin/env node
/**
 * Save everything a browser receives from the live site, byte for byte.
 *
 *   snapshots/site-<date>/origin/<path>              files served by the site itself
 *   snapshots/site-<date>/third-party/<host>/<path>  files it loads from a CDN
 *   snapshots/site-<date>/capture.json               URL, status, headers, size, sha256
 *
 * Starts from the pages and from every file on the `upstream` branch, then follows
 * script, stylesheet and image references and ES module imports. Discovery is
 * pattern-based, which is enough for this site's small, hand-written pages.
 * Usage: node scripts/capture-site.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "./lib/extract.mjs";
import { SITE } from "./lib/registry.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED_HOSTS = new Set([new URL(SITE.origin).host, "cdn.jsdelivr.net"]);
const ENTRY_PAGES = ["/index.html", "/battleship.html"];
const MAX_FILES = 200;
const TIMEOUT_MS = 30_000;
const USER_AGENT = "chainrom-archive-capture/0.1";
/* content-length is left out: fetch decodes gzip, so it would not match `bytes`. */
const KEPT_HEADERS = ["content-type", "etag", "last-modified", "cache-control", "server"];
const TEXT_TYPE = /html|css|javascript|json|xml|text\//;

const git = (...args) => execFileSync("git", args, { maxBuffer: 16 * 1024 * 1024 });

/** Tags whose src/href the browser fetches on its own (anchors are navigation, not loads). */
const RESOURCE_TAG = /<(script|link|img|source|audio|video|iframe)\b[^>]*>/gi;
const ATTRIBUTE = /\b(?:src|href)\s*=\s*["']([^"']+)["']/i;
const MODULE_SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g;
const CSS_URL = /url\(\s*["']?([^"')]+)["']?\s*\)|@import\s+["']([^"']+)["']/g;

/** URLs a fetched file refers to, resolved against its own URL. */
function discover(text, contentType, baseUrl) {
  const specifiers = [];
  if (/html/.test(contentType)) {
    for (const tag of text.match(RESOURCE_TAG) ?? []) {
      const match = tag.match(ATTRIBUTE);
      if (match) specifiers.push(match[1]);
    }
  }
  if (/css/.test(contentType)) {
    for (const match of text.matchAll(CSS_URL)) specifiers.push(match[1] ?? match[2]);
  }
  if (/html|javascript/.test(contentType)) {
    for (const match of text.matchAll(MODULE_SPECIFIER)) specifiers.push(match[1]);
  }
  return specifiers
    .filter((spec) => /^(\.|\/|https?:)/.test(spec))
    .map((spec) => new URL(spec, baseUrl).href.split("#")[0]);
}

const localPath = (url) => {
  const { host, pathname } = new URL(url);
  const clean = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
  return host === new URL(SITE.origin).host ? `origin/${clean}` : `third-party/${host}/${clean}`;
};

function upstreamFiles() {
  return git("ls-tree", "-r", "--name-only", SITE.mirrorRef).toString().split("\n").filter(Boolean);
}

function upstreamBytes(file) {
  try {
    return git("show", `${SITE.mirrorRef}:${file}`);
  } catch {
    return null;
  }
}

async function fetchOne(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
    headers: { "user-agent": USER_AGENT },
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const headers = Object.fromEntries(KEPT_HEADERS.filter((h) => response.headers.has(h)).map((h) => [h, response.headers.get(h)]));
  return { status: response.status, bytes, headers, finalUrl: response.url };
}

async function crawl(seeds) {
  const queue = [...seeds];
  const seen = new Set(queue);
  const records = [];
  const skipped = [];

  while (queue.length) {
    const url = queue.shift();
    if (!ALLOWED_HOSTS.has(new URL(url).host)) {
      skipped.push({ url, reason: "host not allowed" });
      continue;
    }
    if (records.length >= MAX_FILES) throw new Error(`more than ${MAX_FILES} files; refusing to keep crawling`);

    const result = await fetchOne(url);
    records.push({ url, ...result });
    const type = result.headers["content-type"] ?? "";
    if (result.status !== 200 || !TEXT_TYPE.test(type)) continue;

    for (const next of discover(result.bytes.toString("utf8"), type, url)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return { records, skipped };
}

async function main() {
  const seeds = [...new Set([...ENTRY_PAGES, ...upstreamFiles().map((file) => `/${file}`)])]
    .map((pathname) => new URL(pathname, SITE.origin).href);
  const { records, skipped } = await crawl(seeds);

  const capturedAt = new Date().toISOString();
  const outDir = path.join(ROOT, "snapshots", `site-${capturedAt.slice(0, 10)}`);
  const files = [];
  for (const record of records) {
    const relative = localPath(record.url);
    const isSameOrigin = relative.startsWith("origin/");
    const reference = isSameOrigin ? upstreamBytes(relative.slice("origin/".length)) : null;
    const entry = {
      url: record.url,
      path: relative,
      status: record.status,
      bytes: record.bytes.length,
      sha256: sha256(record.bytes),
      headers: record.headers,
      matchesUpstream: reference ? reference.equals(record.bytes) : null,
    };
    files.push(entry);
    if (record.status !== 200) continue;
    await mkdir(path.dirname(path.join(outDir, relative)), { recursive: true });
    await writeFile(path.join(outDir, relative), record.bytes);
  }

  const capture = { schema: 1, origin: SITE.origin, capturedAt, files, skipped };
  await writeFile(path.join(outDir, "capture.json"), JSON.stringify(capture, null, 2) + "\n");

  const saved = files.filter((file) => file.status === 200);
  const different = saved.filter((file) => file.matchesUpstream === false);
  console.log(`${saved.length} files saved to ${path.relative(ROOT, outDir)}`);
  console.log(`${files.length - saved.length} returned a non-200 status; ${skipped.length} skipped`);
  for (const file of different) console.log(`differs from upstream: ${file.path}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
