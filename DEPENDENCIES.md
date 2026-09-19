# Dependencies and continuity notes

What the chainrom reader relies on, and who controls each piece. Everything below was checked
on **2026-09-19** using public, read-only sources (the chain RPC, RDAP, and this repo).
It exists so the site can be kept running if the original author stops maintaining it.

## The reader (this repo)

Static HTML/CSS/JS. It needs no build step and no server code, so any static host works.
`js/vendor/` is bundled `@noble/hashes` (MIT). Nothing else is fetched at runtime except the
chain RPC below and one third-party CDN: `battleship.html` imports pinned builds of
`@noble/curves@1.9.7` and `@noble/hashes@1.8.0` from `cdn.jsdelivr.net`. If jsDelivr or those
versions ever disappear, BATTLESHIP breaks. Vendoring them into `js/vendor/` would remove that
dependency (not done here, so the archive stays a faithful copy of upstream).

## On-chain (Robinhood Chain, chain id 4663)

RPC used by the reader: `https://rpc.mainnet.chain.robinhood.com` (overridable with `?rpc=`).
Explorer: `https://robinhoodchain.blockscout.com`.

Contract code is immutable, so these keep working with or without the original author.
Every address below returned non-empty runtime code on the check date.

| Role | Address | Where referenced |
|------|---------|------------------|
| ROM: DEPTH (maze) | `0x5b2ed277a723c71b4e1c041e1ce0035c313ae931` | `js/app.js` |
| ROM: SIEGE (arena shooter) | `0x16f5c165e7ab37712949e71502072439f0191b4a` | `js/app.js` |
| ROM: DRIFT (asteroids) | `0xd1054ceaebc7b73a76ce259aa56656311ddb31fc` | `js/app.js` |
| ROM named in upstream README | `0xaaa063ded7115b3346b140bf1a1f9c46074a6591` | `README.md` |
| BATTLESHIP referee (wager-enabled) | `0x52c7fee72741f3cc7da7d82543f85fcba47261ce` | `battleship.html` |
| $DEPTH token | `0xc23317490b24d6e53c0137ed5d0d2ae565674bcb` | `index.html`, `battleship.html` |

`owner()` on the ROM contracts returns `0x768222343f19e914a457d05b9b8b2752d160d5bd`
(DEPTH, SIEGE and the README ROM) and `0xff3103200510dd7216dd6877a027df1d8d8ffd28` (DRIFT).
The BATTLESHIP referee and the $DEPTH token expose no `owner()`. What those owners can still do
on a sealed ROM has **not** been reviewed here.

## Off-chain items this repo cannot preserve

Whoever holds these controls the public face of the project. A successor would need
the current holder's cooperation, or would have to start fresh.

- **Domain `chainrom.com`**: registrar Spaceship, Inc., transfer-locked, registered
  2026-09-16, expires 2027-09-16. DNS points at GitHub Pages (`www` CNAMEs to the original
  author's `github.io`).
- **Original repo and Pages deployment**: `github.com/Bubbleduck10/chainrom`.
- **X account**: `@ChainRom_`.
- **Wallet keys**: the play wallet is generated in each visitor's browser and lives in their
  own `localStorage`; nothing here holds anyone's keys.

## Running a successor copy

1. Host the repo as-is on any static host. GitHub Pages works: enable it on a copy **without**
   the `CNAME` file, or with a `CNAME` for a domain you own.
2. Keep the contract addresses above. To point at different contracts, use the query
   overrides or edit the source. `index.html` (`js/app.js`) accepts `?rpc=`, `?game=`, `?rom=`;
   `battleship.html` accepts `?rpc=`, `?chain=`, `?addr=`, `?depth=`.
3. Have a second RPC endpoint ready. The reader verifies chunks against the contract's merkle
   root, so it does not need to trust the node that answers.

## Licensing caveat

The upstream repo has no license, so by default the author keeps all rights. This archive
preserves the code but grants nothing. Before running a public successor deployment or using
the "chainrom" name, get the author's permission or a license.
