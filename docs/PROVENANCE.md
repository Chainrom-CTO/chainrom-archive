# Provenance

## Source

| | |
|---|---|
| Original repository | https://github.com/Bubbleduck10/chainrom |
| Original site | https://chainrom.com |
| Snapshot taken | 2026-09-19 |
| Upstream commit | `f6e8fc3` ("Add DRIFT — vector asteroid shooter — to the game library") |
| Git tag | `snapshot-2026-09-19` |

On the snapshot date `index.html`, `battleship.html`, `js/app.js` and `css/site.css` served by
chainrom.com were byte-identical to upstream `master` at that commit.

The full upstream history is preserved. `main` adds commits on top of it; the `upstream` branch
is the untouched original.

## Changes from upstream

- `CNAME` removed, so a copy of this repository can never claim the `chainrom.com` domain.
- `README.md` replaced. The original is on the `upstream` branch.
- Added `data/` (chain capture), `scripts/`, `docs/`, `.github/`, and repository metadata files.

The site files themselves are unchanged unless a later commit on `main` says otherwise.

## Chain capture

`data/` was produced by `npm run export` against `https://rpc.mainnet.chain.robinhood.com`
(chain id 4663) at block 66913404 on 2026-09-19. The exporter writes nothing unless the capture
passes the same checks as `npm run verify`.

- `data/roms/<id>.body` is the gzip payload of a ROM: its chunks, concatenated in order.
  `data/manifest.json` records each chunk's size and the pointer contract it was read from.
- `data/bytecode/<id>.hex` is the runtime bytecode of each contract.
- All four ROMs were sealed when captured. The reader refuses unsealed ROMs because their
  root can still change.

## Licensing

The upstream repository publishes no license, so by default its author retains all rights.
This archive preserves the work; it does not grant any rights to it.

Bundled third-party code in `js/vendor/` is `@noble/hashes` by Paul Miller, MIT licensed, with
its notice in `js/vendor/LICENSE-noble-hashes`.

Before running a public successor deployment, or using the "chainrom" name, obtain the author's
permission or a license. The license status of the tooling added in this repository is undecided
and will be settled together with the upstream question.
