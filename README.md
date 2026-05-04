# asc — App Store Connect CLI

A fast, lightweight command-line interface for the [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi), built with [Bun](https://bun.sh) and TypeScript.

## Features

- Full coverage of core App Store Connect API resources
- Pretty-printed JSON output by default, with `--raw`, `--table`, and `--markdown` modes
- Multiple authentication methods: environment variables, config file, macOS Keychain
- Named credential profiles for managing multiple accounts
- Automatic retry with exponential backoff on rate limits (429) and server errors (503)
- ANSI color output with `NO_COLOR` support

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.0.0
- macOS (required for Keychain-based authentication; env var and config file auth work on any platform)

## Installation

### Build from source

```sh
git clone https://github.com/ashutoshpw/asc-cli.git
cd asc-cli
bun install
bun run build
```

This produces a standalone binary at `dist/asc`. Move it to a directory on your `PATH`:

```sh
mv dist/asc /usr/local/bin/asc
```

Or use `bun link` to run it directly via Bun during development:

```sh
bun link
asc --version
```

## Authentication

`asc` requires an App Store Connect API key. Generate one at **App Store Connect → Users and Access → Integrations → API Keys**.

You will need:
- **Key ID** — the 10-character identifier shown next to the key
- **Issuer ID** — shown at the top of the API Keys page
- **Private key** — the `.p8` file downloaded when the key is created (can only be downloaded once)

### Option 1: Environment variables

```sh
export ASC_KEY_ID=XXXXXXXXXX
export ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export ASC_PRIVATE_KEY_PATH=/path/to/AuthKey_XXXXXXXXXX.p8
```

See [`.env.example`](.env.example) for the full list of supported variables.

### Option 2: Config file (`~/.asc/config.json`)

Add a credential profile interactively:

```sh
asc auth add
```

This stores credentials in `~/.asc/config.json` and, optionally, the private key path in the macOS Keychain.

Manage profiles:

```sh
asc auth list                  # List stored profiles
asc auth switch <name>         # Switch default profile
asc auth remove <name>         # Remove a profile
```

### Option 3: macOS Keychain

When you add credentials via `asc auth add`, the private key reference is stored securely in the macOS Keychain under the service name `asc`. The config file stores only non-sensitive fields (key ID, issuer ID).

Use `--profile <name>` on any command to override the active credential profile:

```sh
asc --profile mywork apps list
```

## Commands

| Command | Description |
|---|---|
| `asc apps` | Manage apps |
| `asc builds` | Manage builds |
| `asc versions` | Manage app versions |
| `asc testflight` | Manage TestFlight beta testing |
| `asc certificates` | Manage signing certificates |
| `asc profiles` | Manage provisioning profiles |
| `asc bundle-ids` | Manage bundle identifiers |
| `asc devices` | Manage registered devices |
| `asc users` | Manage App Store Connect users |
| `asc iap` | Manage in-app purchases |
| `asc subscriptions` | Manage auto-renewable subscriptions |
| `asc reviews` | View customer reviews |
| `asc analytics` | Sales, proceeds, and analytics reports |
| `asc auth` | Manage authentication credentials |

Run `asc <command> --help` for subcommands and options.

## Global Options

| Flag | Description |
|---|---|
| `--help`, `-h` | Show help for the command |
| `--version`, `-v` | Show version number |
| `--raw` | Output raw (minified) JSON |
| `--output`, `-o` | Output format: `pretty` (default), `table`, `markdown` |
| `--profile`, `-p` | Use a named authentication profile |
| `--debug` | Enable debug logging |

## Examples

```sh
# List all apps
asc apps list

# List builds for a specific app
asc builds list --app-id 1234567890

# List beta testers on TestFlight
asc testflight testers

# Fetch sales report for a vendor
asc analytics sales --vendor 12345678 --date 2026-01

# Show all certificates
asc certificates list

# Use a specific profile for one command
asc --profile clientA apps list
```

## License

[MIT](LICENSE) © Ashutosh Kumar
