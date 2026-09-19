# Archive notice

This is an **unofficial archive** of [chainrom.com](https://chainrom.com), preserved so the
site's source survives if the original goes away. It is not the official project and is not
affiliated with or endorsed by its author.

- **Original source:** https://github.com/Bubbleduck10/chainrom
- **Original site:** https://chainrom.com
- **Snapshot taken:** 2026-09-19, at upstream commit `f6e8fc3`
  ("Add DRIFT — vector asteroid shooter — to the game library")
- **Verified:** on the snapshot date, `index.html`, `battleship.html`, `js/app.js` and
  `css/site.css` served by chainrom.com were byte-identical to upstream `master`.

The full upstream commit history is kept intact. All credit for the work belongs to the
original author. The upstream repository carries no license, so no additional rights are
granted here; `js/vendor/` remains MIT licensed (see `js/vendor/LICENSE-noble-hashes`).

## Changes from upstream

Only one commit sits on top of the upstream history:

- Removed `CNAME`, so this archive can never claim the `chainrom.com` domain if GitHub Pages
  is enabled on it.
- Added this file.

## What this does not preserve

The game itself is not in this repository. The engine and data live as contract code on
Robinhood Chain (chain id 4663), and the page reads them from an RPC node at runtime. The ROM
contract is `0xaaa063ded7115b3346b140bf1a1f9c46074a6591` (see `README.md`). This archive keeps
the reader; the chain keeps the game.
