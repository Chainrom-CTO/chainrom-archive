# Contributing

## Ground rules

- **`upstream` is read-only.** It mirrors the original repository and is updated only by
  `scripts/sync-upstream.sh`. Do not commit to it.
- **Site changes go on `main` and stay small.** Each one should say what it fixes and why.
  `git diff upstream main -- index.html battleship.html css js` must remain easy to review.
- **Claims need evidence.** Documentation states what a script or the chain can confirm.

## Workflow

1. Branch from `main`.
2. Make the change. Run `npm run verify`; it needs Node 20 or later and no install step.
3. Commit using `<type>: <description>` with type one of `feat`, `fix`, `refactor`, `docs`,
   `test`, `chore`, `perf`, `ci`.
4. Open a pull request describing the change and how you checked it.

## Refreshing the chain capture

`npm run export` re-reads every contract in `scripts/lib/registry.mjs` and rewrites `data/`. It
refuses to write anything that fails verification. Review the resulting diff: for sealed ROMs and
immutable contracts it should be empty apart from the capture time and block number.

## Refreshing the site capture

`npm run capture` fetches the live site and writes a new dated directory under `snapshots/`.
Keep earlier snapshots; they are the record of what the site looked like at the time.

## Adding a contract

Add it to `scripts/lib/registry.mjs`, run `npm run export`, and document it in
`docs/DEPENDENCIES.md`.
