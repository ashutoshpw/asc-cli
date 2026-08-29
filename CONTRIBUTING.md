# Contributing

## Local setup

This repository uses Bun 1.4.0. Install dependencies from the committed lockfile:

```sh
bun install
```

Before committing, run:

```sh
bun run lint
bun run typecheck
bun test
bun run test:coverage
bun run build
```

The pre-commit hook checks staged tests and the 500-line code-file limit. The
pre-push hook runs the complete local check command.

## Changes and tests

Keep command behavior backward-compatible unless the change explicitly calls
for a CLI change. Add regression tests for API paths, request bodies, error
handling, output, and exit behavior. Tests must use mocked fetches or local
fixtures; do not add Apple credentials or live App Store Connect calls.

## Releases

Update the changelog for user-visible changes, merge the change to `main`, and
create a `vX.Y.Z` tag when the release is ready. The release workflow verifies
the tag against `package.json`, builds the supported binaries, publishes
checksums, and creates artifact attestations.
