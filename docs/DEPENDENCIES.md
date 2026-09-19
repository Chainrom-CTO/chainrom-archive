# Dependencies

What the chainrom reader relies on, and who controls each piece. Checked 2026-09-19 using
public, read-only sources: the chain RPC, RDAP, and this repository. `npm run watch` re-checks
the chain, site and domain items daily.

## The reader

Static HTML, CSS and JS with no build step and no server code, so any static host works.
`js/vendor/` bundles `@noble/hashes` (MIT).

At runtime the pages fetch from two places:

- The chain RPC below.
- `cdn.jsdelivr.net`: `battleship.html` imports pinned builds of `@noble/curves@1.9.7` and
  `@noble/hashes@1.8.0`. If jsDelivr or those versions disappear, BATTLESHIP stops working.
  The exact modules are archived under `snapshots/site-2026-09-19/third-party/`; vendoring
  them into `js/vendor/` would remove the dependency.

## On chain (Robinhood Chain, id 4663)

RPC used by the reader: `https://rpc.mainnet.chain.robinhood.com`, overridable with `?rpc=`.
Explorer: `https://robinhoodchain.blockscout.com`.

Contract code is immutable, and `data/` holds a verified copy of each contract below.

| Id | Role | Address |
|----|------|---------|
| `depth` | ROM: DEPTH (maze) | `0x5b2ed277a723c71b4e1c041e1ce0035c313ae931` |
| `siege` | ROM: SIEGE (arena shooter) | `0x16f5c165e7ab37712949e71502072439f0191b4a` |
| `drift` | ROM: DRIFT (asteroids) | `0xd1054ceaebc7b73a76ce259aa56656311ddb31fc` |
| `readme-rom` | ROM named in the upstream README | `0xaaa063ded7115b3346b140bf1a1f9c46074a6591` |
| `battleship-referee` | BATTLESHIP referee (wager-enabled) | `0x52c7fee72741f3cc7da7d82543f85fcba47261ce` |
| `depth-token` | $DEPTH token | `0xc23317490b24d6e53c0137ed5d0d2ae565674bcb` |

Who sent the creation transactions (`data/explorer.json`, `data/history/`). Both are plain
wallets, not contracts.

| Wallet | Created |
|--------|---------|
| `0x768222343f19e914a457d05b9b8b2752d160d5bd` | DEPTH, SIEGE, README ROM, and the $DEPTH token (through contracts, see below) |
| `0xff3103200510dd7216dd6877a027df1d8d8ffd28` | DRIFT and the BATTLESHIP referee |

For each ROM, the wallet that created it is also the address that `owner()` returns. Every chunk
contract was created by its own ROM contract. The referee and the token expose no `owner()`.

The $DEPTH token was not deployed directly. The first wallet above sent a transaction to contract
`0xe33e9e479df8802cb0866d5d05258bec4cf62948`, and the explorer lists contract
`0x3711cea4feade896c913c68f01eda97cb06d1a42` as the token's creator. Both are contracts. The
explorer verifies the token as `PonsV2LauncherToken` (name "Chainrom", symbol "Depth"). The other
five contracts have no verified source.

`data/history/<id>.json` holds each contract's creation transaction and, for a ROM, every
transaction that emitted one of its events: one upload per chunk, then the seal. Inputs and
receipts are complete, so a ROM's publication can be replayed. For the BATTLESHIP referee and the
token only the creation transaction is recorded.

All four ROMs are sealed, which the reader treats as final. The contracts have not been audited
here, so what an owner can still do beyond that is unreviewed.

## Held by others

These are not in this repository. A successor needs the current holder's cooperation, or has to
start fresh.

- **Domain `chainrom.com`**: registrar Spaceship, Inc., transfer-locked, registered 2026-09-16,
  expires 2027-09-16.
- **Original repository and Pages deployment**: `github.com/Bubbleduck10/chainrom`.
- **X account**: `@ChainRom_`.

Play wallets are generated in each visitor's browser and stored in that browser's
`localStorage`. Nothing here holds anyone's keys.

## Running a successor copy

1. Serve the repository from any static host. On GitHub Pages, do not add a `CNAME` for a domain
   you do not control.
2. Keep the addresses above, or override them: `index.html` accepts `?rpc=`, `?game=`, `?rom=`;
   `battleship.html` accepts `?rpc=`, `?chain=`, `?addr=`, `?depth=`.
3. Have a second RPC endpoint ready. The reader checks every chunk against the sealed merkle
   root, so it does not need to trust the node that answers.
