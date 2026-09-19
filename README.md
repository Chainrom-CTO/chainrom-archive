# chainrom-archive

A verified archive of [chainrom](https://chainrom.com), a browser reader that boots games
stored as contract code on Robinhood Chain (chain id 4663), plus the on-chain data the reader
depends on. It is maintained so the project can be continued if the original goes offline.

This is an unofficial archive. The original project is
[Bubbleduck10/chainrom](https://github.com/Bubbleduck10/chainrom); all credit for the work
belongs to its author. See [docs/PROVENANCE.md](docs/PROVENANCE.md).

## Status

| Item | State |
|------|-------|
| Original source | Mirrored on the `upstream` branch; snapshot tagged `snapshot-2026-09-19` |
| Live site | Byte-exact copy of the 26 files the browser receives (19 from the site, 7 from a CDN), with response headers, in `snapshots/` |
| ROMs | 4 ROMs and their 31 chunk contracts captured at block 67206628, verified against the sealed on-chain hashes |
| Games as files | Engine `.js`, `.wasm` and `README.txt` extracted from every ROM into `data/extracted/`, each hash-checked |
| Contract bytecode | 6 contracts captured and hash-checked |
| Deployers | Creator, creation transaction and block of all 6 contracts, from the block explorer, in `data/explorer.json` |
| Page captures | Full-page screenshots and PDFs of the live pages in `docs/captures/` |
| Continuity checks | Run daily; failures open an issue |
| License | None published upstream; see [Provenance](docs/PROVENANCE.md#licensing) |

Not preserved: the engine source code, the publisher and the test suite are not public
upstream. See [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md#limits).

## Documents

| Document | Contents |
|----------|----------|
| [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) | How a program is stored on chain and read back; byte-level formats |
| [docs/PROVENANCE.md](docs/PROVENANCE.md) | Where everything came from, what changed, licensing |
| [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) | Contracts, domain and other things the site relies on, and who controls them |
| `data/extracted/<id>/README.txt` | The README stored on chain inside each ROM |
| [docs/captures/](docs/captures/2026-09-19) | Screenshots and PDFs of the live pages |

## Layout

| Path | Contents |
|------|----------|
| `index.html`, `battleship.html`, `css/`, `js/` | The site, as published upstream |
| `data/` | Chain capture: `manifest.json`, ROM bodies, extracted files, contract bytecode |
| `snapshots/` | Byte-exact copies of what the live site served, with headers and hashes |
| `scripts/` | Export, capture, verification and continuity tooling (Node 20+, no dependencies) |
| `docs/` | Documentation and page captures |

## Verify the archive

Offline, from the files in this repository:

```sh
npm run verify
```

For each ROM this rebuilds the merkle tree from the stored chunks and checks the root, the body
hash, and the hash of the inflated ROM against the values sealed on-chain. It checks each chunk
contract's hashes, each file inside the bundle, each extracted file on disk, each contract's
bytecode hash, and each saved site file against its recorded hash. To additionally compare
against the live chain, including every chunk contract's address, order and code:

```sh
npm run verify:online
```

The checks reuse the reader's own `js/merkle.mjs` and `js/load.mjs`, so the archive is held to
the same rules the site applies.

## Run the site locally

The site is static. From the repository root:

```sh
python3 -m http.server 8000
```

and open http://localhost:8000. The page reads game data from the chain RPC at runtime, so it
needs network access; see [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md). DEPTH, SIEGE and DRIFT
were booted this way from this repository and verified by the page's own loader.

## Branches

- `main`: the archive, with tooling and documentation. Site files match upstream except where
  a commit says otherwise.
- `upstream`: an unmodified mirror of the original repository. It is only ever fast-forwarded.
  If the original rewrites its history, the new history is kept on a dated branch instead.

`git diff upstream main -- index.html battleship.html css js` shows every change to the site.

## Continuity

`.github/workflows/watch.yml` runs daily. It fast-forwards `upstream`, then checks that every
archived contract still has the archived code, that the live site is reachable, and that the
domain registration is not close to lapsing. Any failure opens an issue labelled `watch`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).
