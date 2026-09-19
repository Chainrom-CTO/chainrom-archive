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
(chain id 4663) at block 67206628 on 2026-09-19. The exporter writes nothing unless the capture
passes the same checks as `npm run verify`.

- `data/manifest.json` records, for each ROM, the merkle root, body hash, inflated hash and
  length, and for each of its chunk contracts the address (in on-chain order), size, leaf hash
  and code hash. It also lists every file inside the ROM's bundle with its size and sha256.
- `data/roms/<id>.body` is the gzip payload of a ROM: its chunks, concatenated in order.
- `data/extracted/<id>/` holds the files inside each ROM's bundle: the engine `.js`, the
  `.wasm`, and the `README.txt` stored on chain.
- `data/bytecode/<id>.hex` is the runtime bytecode of each contract.
- All four ROMs were sealed when captured. The reader refuses unsealed ROMs because their
  root can still change.

## Site capture

`snapshots/site-2026-09-19/` was produced by `npm run capture`. It holds the exact bytes the
live site returned, under `origin/` for files served by chainrom.com and `third-party/` for the
jsDelivr modules that `battleship.html` imports. `capture.json` records each URL, status, size,
sha256 and selected response headers.

All 19 files served by chainrom.com were byte-identical to upstream `master` at the snapshot
commit. `/CNAME` returns 404 because GitHub Pages does not serve it. The site has no image or
font files; its favicon is an inline SVG.

`docs/captures/2026-09-19/` holds full-page screenshots and PDFs of the live pages, taken with
Chrome. Screenshots are downscaled to 1470 px wide.

## Not captured

- **Explorer metadata** (deployer address, deployment transactions, verified source if any).
  The block explorer sits behind a bot-detection challenge, which this project does not bypass.
  It can be recorded by hand from a browser.
- **Engine source code, the publisher, the packer and the test suite.** These are referred to
  by the site and the on-chain READMEs but are not in the public upstream repository.

## Licensing

The upstream repository publishes no license, so by default its author retains all rights.
This archive preserves the work; it does not grant any rights to it.

Bundled third-party code in `js/vendor/` is `@noble/hashes` by Paul Miller, MIT licensed, with
its notice in `js/vendor/LICENSE-noble-hashes`.

Before running a public successor deployment, or using the "chainrom" name, obtain the author's
permission or a license. The license status of the tooling added in this repository is undecided
and will be settled together with the upstream question.
