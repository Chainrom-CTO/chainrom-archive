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
| ROM data (4 ROMs) | Captured from chain block 66913404 and verified against sealed on-chain hashes |
| Contract bytecode (6 contracts) | Captured and hash-checked |
| Continuity checks | Run daily; failures open an issue |
| License | None published upstream; see [Provenance](docs/PROVENANCE.md#licensing) |

## Layout

| Path | Contents |
|------|----------|
| `index.html`, `battleship.html`, `css/`, `js/` | The site, as published upstream |
| `data/` | Chain capture: `manifest.json`, ROM bodies, contract bytecode |
| `scripts/` | Export, verification and continuity tooling (Node 20+, no dependencies) |
| `docs/` | Provenance and dependency notes |

## Verify the archive

Offline, from the files in this repository:

```sh
npm run verify
```

For each ROM this rebuilds the merkle tree from the stored chunks and checks the root, the body
hash, and the hash of the inflated ROM against the values sealed on-chain. It also checks each
contract's bytecode hash. To additionally compare against the live chain:

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
needs network access; see [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md).

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
