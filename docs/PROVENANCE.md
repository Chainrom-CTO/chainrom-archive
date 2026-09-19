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

## Domain capture

`snapshots/domain-2026-09-19.json` was produced by `npm run domain`. It holds DNS records for
`chainrom.com` and `www.chainrom.com` and the RDAP registration record, all public data. The
apex points at GitHub Pages addresses and `www` is a CNAME to the original author's `github.io`
host. It is evidence of the state on that date; the domain is held by the original author.

## Explorer capture

`data/explorer.json` records, for each of the six contracts, the creator address, creation
transaction, block and timestamp, and whether the explorer holds verified source. It was read
from the block explorer's public API on 2026-09-19. The explorer sits behind a bot-detection
check, which this project does not attempt to bypass; the records were fetched from a browser
session in which the repository owner had passed the check themselves. `npm run verify` checks
that these records describe the same contracts as the manifest, but they cannot be verified
offline, and the chain is the authority.

## Deployment history

`data/history/<id>.json` was produced by `npm run history` from the chain RPC. For every contract
it holds the creation transaction; for each ROM it also holds every transaction that emitted one
of the ROM's events (found with `eth_getLogs`): one upload per chunk and the final seal. Each
record keeps the full input and the receipt's logs. For a direct deployment the input is the init
code, so the deployment can be replayed exactly.

`npm run verify` checks each input against its recorded hash, that every transaction succeeded,
that the first transaction created the contract, and that each archived chunk appears in an
upload transaction, in publication order. The chunk data is therefore tied to how it was
published, not only to its final on-chain state.

## Not captured

- **Live contract state.** Token balances and liquidity, and any BATTLESHIP matches in progress,
  are chain state and are not archived; only code and setup history are.
- **Verified source of the $DEPTH token.** The explorer holds it (contract `PonsV2LauncherToken`,
  about 640 KB of JSON including Uniswap v4 libraries); only its metadata is recorded here. It
  appears to be a third-party launcher template rather than chainrom's own code.
- **Engine source code, the publisher, the packer and the test suite.** These are referred to
  by the site and the on-chain READMEs but are not in the public upstream repository. None of
  the other five contracts has verified source on the explorer.

## Licensing

The upstream repository publishes no license, so by default its author retains all rights.
This archive preserves the work; it does not grant any rights to it.

Bundled third-party code in `js/vendor/` is `@noble/hashes` by Paul Miller, MIT licensed, with
its notice in `js/vendor/LICENSE-noble-hashes`.

Before running a public successor deployment, or using the "chainrom" name, obtain the author's
permission or a license. The license status of the tooling added in this repository is undecided
and will be settled together with the upstream question.
