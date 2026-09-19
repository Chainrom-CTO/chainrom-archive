import { keccak_256 } from "../../js/vendor/noble-sha3.js";

/** Lowercase 0x-prefixed hex. */
export const toHex = (bytes) => "0x" + Buffer.from(bytes).toString("hex");

export const fromHex = (hex) => new Uint8Array(Buffer.from(hex.replace(/^0x/, ""), "hex"));

/** keccak256 of `bytes`, as 0x-prefixed hex. */
export const keccak = (bytes) => toHex(keccak_256(bytes));
