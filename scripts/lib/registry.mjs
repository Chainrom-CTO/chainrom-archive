/**
 * The contracts the chainrom reader depends on. Export, verify and watch all
 * read this list, so an address is only ever written down once.
 *
 * `role` is one of:
 *   rom      a sealed ROM: header, merkle root, and pointer contracts holding chunks
 *   referee  the BATTLESHIP referee (wager-enabled)
 *   token    the $DEPTH token
 */
export const CHAIN = Object.freeze({
  id: 4663,
  name: "Robinhood Chain",
  rpc: "https://rpc.mainnet.chain.robinhood.com",
});

export const CONTRACTS = Object.freeze([
  { id: "depth", label: "DEPTH", role: "rom", address: "0x5b2ed277a723c71b4e1c041e1ce0035c313ae931" },
  { id: "siege", label: "SIEGE", role: "rom", address: "0x16f5c165e7ab37712949e71502072439f0191b4a" },
  { id: "drift", label: "DRIFT", role: "rom", address: "0xd1054ceaebc7b73a76ce259aa56656311ddb31fc" },
  { id: "readme-rom", label: "README ROM", role: "rom", address: "0xaaa063ded7115b3346b140bf1a1f9c46074a6591" },
  { id: "battleship-referee", label: "BATTLESHIP referee", role: "referee", address: "0x52c7fee72741f3cc7da7d82543f85fcba47261ce" },
  { id: "depth-token", label: "$DEPTH token", role: "token", address: "0xc23317490b24d6e53c0137ed5d0d2ae565674bcb" },
]);

/** What the domain looked like when this archive was cut. */
export const DOMAIN = Object.freeze({
  name: "chainrom.com",
  expires: "2027-09-16",
});

/** Site origin, and where the pristine source is mirrored. */
export const SITE = Object.freeze({
  origin: "https://chainrom.com",
  mirrorRef: "upstream",
});

/** Warn this many days before the domain registration lapses. */
export const DOMAIN_WARN_DAYS = 60;
