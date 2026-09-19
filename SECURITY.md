# Security policy

## Scope

This repository contains a static web reader, archive tooling, and captured chain data. It does
not operate any contract, hold any keys, or run any service.

In scope: the site code, the scripts in `scripts/`, and the workflows in `.github/`.
Out of scope: the on-chain contracts and the $DEPTH token, which are controlled by their
deployer and cannot be changed from here.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting on this
repository's Security tab, and include steps to reproduce.

## Handling secrets

Never commit private keys, seed phrases, or API tokens. The site generates play wallets in the
browser; a leaked wallet key belongs to its user, and the affected wallet should be treated as
compromised.
