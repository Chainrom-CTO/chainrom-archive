/**
 * Reading the files out of a ROM's inflated payload (a CROM bundle, see
 * js/bundle.mjs).
 */
import { createHash } from "node:crypto";
import { openBundle } from "../../js/bundle.mjs";

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * Bundle file names come from a chain, so they are untrusted input. Only plain
 * relative paths are accepted; anything that could escape the output directory
 * is refused rather than cleaned up.
 */
export function assertSafeName(name) {
  const segments = name.split("/");
  const isUnsafe =
    name.startsWith("/") ||
    name.includes("\\") ||
    name.includes("\0") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..");
  if (isUnsafe) throw new Error(`unsafe file name in bundle: ${JSON.stringify(name)}`);
}

/** The bundle's files as `{ name, bytes }`, in published order. */
export function bundleFiles(raw) {
  return [...openBundle(raw)].map(([name, bytes]) => {
    assertSafeName(name);
    return { name, bytes };
  });
}

/** What the manifest records about each file: name, size and sha256. */
export const describeFiles = (files) =>
  files.map(({ name, bytes }) => ({ name, bytes: bytes.length, sha256: sha256(bytes) }));
