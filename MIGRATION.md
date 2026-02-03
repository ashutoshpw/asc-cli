# Bun CLI Migration Plan

This document tracks the migration of the Go-based App Store Connect CLI to Bun/TypeScript.

## Migration Overview

| Aspect | Go CLI | Bun CLI |
|--------|--------|---------|
| Default output | Minified JSON | Pretty-printed JSON |
| Raw JSON | Default | `--raw` flag |
| Binary | ~15-20MB | ~80-100MB (standalone) |
| Keychain | `keyring` library | macOS FFI (Security.framework) |
| CLI framework | `ffcli` | Native `util.parseArgs` |

---

## Phase 1: Foundation

### Project Setup
- [ ] Initialize package.json with dependencies
- [ ] Configure tsconfig.json for Bun
- [ ] Create bunfig.toml
- [ ] Set up directory structure

### CLI Framework
- [ ] Implement argument parser (`src/cli/parser.ts`)
- [ ] Implement command router (`src/cli/router.ts`)
- [ ] Implement help generator (`src/cli/help.ts`)
- [ ] Create command registry (`src/cli/registry.ts`)
- [ ] Add global flags: `--raw`, `--help`, `--version`, `--profile`, `--debug`

### API Client
- [ ] Implement JWT generation with ES256 (`src/api/jwt.ts`)
- [ ] Implement HTTP client with retry logic (`src/api/client.ts`)
- [ ] Add rate limit handling (429, 503)
- [ ] Add request/response logging (debug mode)
- [ ] Implement pagination support

### Output System
- [ ] Pretty-print JSON formatter (default) (`src/output/pretty.ts`)
- [ ] Raw JSON formatter (`src/output/raw.ts`)
- [ ] Table formatter (`src/output/table.ts`)
- [ ] Markdown formatter (`src/output/markdown.ts`)
- [ ] ANSI color support with NO_COLOR detection

### Authentication
- [ ] Config file loading (`~/.asc/config.json`)
- [ ] Environment variable support
- [ ] macOS Keychain via FFI (`src/auth/keychain/macos.ts`)
- [ ] Credential resolution with priority order

### Basic Commands
- [ ] `asc version` - Print version
- [ ] `asc help` - Show help
- [ ] `asc --help` - Show help for any command

---

## Phase 2: Auth Commands

### `asc auth` Command Group
- [ ] `asc auth add` - Add new credentials
- [ ] `asc auth list` - List stored credentials
- [ ] `asc auth remove` - Remove credentials
- [ ] `asc auth switch` - Switch default profile
- [ ] `asc auth status` - Show current auth status

---

## Phase 3: Core Commands

### `asc apps` Command Group
- [ ] `asc apps list` - List all apps
- [ ] `asc apps get` - Get app by ID
- [ ] `asc apps create` - Create new app (reserved)

### `asc builds` Command Group
- [ ] `asc builds list` - List builds
- [ ] `asc builds get` - Get build by ID
- [ ] `asc builds latest` - Get latest build for app
- [ ] `asc builds expire` - Expire a build

### `asc versions` Command Group
- [ ] `asc versions list` - List app store versions
- [ ] `asc versions get` - Get version by ID
- [ ] `asc versions create` - Create new version
- [ ] `asc versions update` - Update version

---

## Phase 4: TestFlight Commands

### `asc testflight` Command Group
- [ ] `asc testflight info` - Get beta app info
- [ ] `asc testflight update` - Update beta app info

### `asc beta-groups` Command Group
- [ ] `asc beta-groups list` - List beta groups
- [ ] `asc beta-groups get` - Get beta group
- [ ] `asc beta-groups create` - Create beta group
- [ ] `asc beta-groups delete` - Delete beta group
- [ ] `asc beta-groups add-testers` - Add testers to group
- [ ] `asc beta-groups remove-testers` - Remove testers from group
- [ ] `asc beta-groups add-builds` - Add builds to group
- [ ] `asc beta-groups remove-builds` - Remove builds from group

### `asc beta-testers` Command Group
- [ ] `asc beta-testers list` - List beta testers
- [ ] `asc beta-testers get` - Get beta tester
- [ ] `asc beta-testers invite` - Invite beta tester
- [ ] `asc beta-testers delete` - Remove beta tester

---

## Phase 5: Signing & Provisioning

### `asc certificates` Command Group
- [ ] `asc certificates list` - List certificates
- [ ] `asc certificates get` - Get certificate
- [ ] `asc certificates create` - Create certificate
- [ ] `asc certificates revoke` - Revoke certificate

### `asc profiles` Command Group
- [ ] `asc profiles list` - List provisioning profiles
- [ ] `asc profiles get` - Get profile
- [ ] `asc profiles create` - Create profile
- [ ] `asc profiles delete` - Delete profile

### `asc bundle-ids` Command Group
- [ ] `asc bundle-ids list` - List bundle IDs
- [ ] `asc bundle-ids get` - Get bundle ID
- [ ] `asc bundle-ids create` - Create bundle ID
- [ ] `asc bundle-ids delete` - Delete bundle ID
- [ ] `asc bundle-ids capabilities` - Manage capabilities

### `asc devices` Command Group
- [ ] `asc devices list` - List devices
- [ ] `asc devices get` - Get device
- [ ] `asc devices register` - Register device
- [ ] `asc devices update` - Update device
- [ ] `asc devices disable` - Disable device

---

## Phase 6: In-App Purchases & Subscriptions

### `asc iap` Command Group
- [ ] `asc iap list` - List in-app purchases
- [ ] `asc iap get` - Get IAP by ID
- [ ] `asc iap create` - Create IAP
- [ ] `asc iap update` - Update IAP
- [ ] `asc iap delete` - Delete IAP
- [ ] `asc iap localizations` - Manage localizations
- [ ] `asc iap price-points` - Manage pricing
- [ ] `asc iap submit` - Submit for review

### `asc subscriptions` Command Group
- [ ] `asc subscriptions list` - List subscriptions
- [ ] `asc subscriptions get` - Get subscription
- [ ] `asc subscriptions create` - Create subscription
- [ ] `asc subscriptions update` - Update subscription
- [ ] `asc subscriptions groups` - Manage subscription groups
- [ ] `asc subscriptions localizations` - Manage localizations
- [ ] `asc subscriptions prices` - Manage pricing
- [ ] `asc subscriptions offers` - Manage promotional offers

### `asc offer-codes` Command Group
- [ ] `asc offer-codes list` - List offer codes
- [ ] `asc offer-codes create` - Create offer code
- [ ] `asc offer-codes get` - Get offer code
- [ ] `asc offer-codes deactivate` - Deactivate offer code

### `asc win-back-offers` Command Group
- [ ] `asc win-back-offers list` - List win-back offers
- [ ] `asc win-back-offers get` - Get win-back offer
- [ ] `asc win-back-offers create` - Create win-back offer
- [ ] `asc win-back-offers update` - Update win-back offer
- [ ] `asc win-back-offers delete` - Delete win-back offer

### `asc promoted-purchases` Command Group
- [ ] `asc promoted-purchases list` - List promoted purchases
- [ ] `asc promoted-purchases get` - Get promoted purchase
- [ ] `asc promoted-purchases create` - Create promoted purchase
- [ ] `asc promoted-purchases update` - Update promoted purchase
- [ ] `asc promoted-purchases delete` - Delete promoted purchase

---

## Phase 7: App Store Metadata

### `asc app-infos` Command Group
- [ ] `asc app-infos list` - List app infos
- [ ] `asc app-infos get` - Get app info
- [ ] `asc app-infos update` - Update app info

### `asc localizations` Command Group
- [ ] `asc localizations list` - List version localizations
- [ ] `asc localizations get` - Get localization
- [ ] `asc localizations create` - Create localization
- [ ] `asc localizations update` - Update localization
- [ ] `asc localizations delete` - Delete localization

### `asc categories` Command Group
- [ ] `asc categories list` - List app categories
- [ ] `asc categories get` - Get category

### `asc age-rating` Command Group
- [ ] `asc age-rating get` - Get age rating declaration
- [ ] `asc age-rating update` - Update age rating declaration

### `asc eula` Command Group
- [ ] `asc eula get` - Get EULA
- [ ] `asc eula create` - Create EULA
- [ ] `asc eula update` - Update EULA
- [ ] `asc eula delete` - Delete EULA

---

## Phase 8: Assets & Screenshots

### `asc assets` Command Group
- [ ] `asc assets screenshots list` - List screenshots
- [ ] `asc assets screenshots upload` - Upload screenshot
- [ ] `asc assets screenshots delete` - Delete screenshot
- [ ] `asc assets previews list` - List previews
- [ ] `asc assets previews upload` - Upload preview
- [ ] `asc assets previews delete` - Delete preview

### `asc routing-coverage` Command Group
- [ ] `asc routing-coverage get` - Get routing coverage
- [ ] `asc routing-coverage upload` - Upload routing coverage
- [ ] `asc routing-coverage delete` - Delete routing coverage

---

## Phase 9: Review & Submission

### `asc submit` Command Group
- [ ] `asc submit` - Submit for review
- [ ] `asc submit status` - Check submission status

### `asc publish` Command Group
- [ ] `asc publish` - Release to App Store
- [ ] `asc publish schedule` - Schedule release

### `asc reviews` Command Group
- [ ] `asc reviews list` - List customer reviews
- [ ] `asc reviews get` - Get review
- [ ] `asc reviews respond` - Respond to review
- [ ] `asc reviews summarize` - Get AI summarization

---

## Phase 10: Analytics & Reports

### `asc analytics` Command Group
- [ ] `asc analytics reports list` - List available reports
- [ ] `asc analytics reports get` - Get report
- [ ] `asc analytics reports download` - Download report

### `asc performance` Command Group
- [ ] `asc performance metrics` - Get performance metrics
- [ ] `asc performance diagnostics` - Get diagnostic logs

### `asc finance` Command Group
- [ ] `asc finance reports list` - List finance reports
- [ ] `asc finance reports download` - Download finance report
- [ ] `asc finance sales` - Get sales reports

### `asc crashes` Command Group
- [ ] `asc crashes list` - List crash reports
- [ ] `asc crashes get` - Get crash details

### `asc feedback` Command Group
- [ ] `asc feedback list` - List beta feedback
- [ ] `asc feedback get` - Get feedback details

---

## Phase 11: Users & Roles

### `asc users` Command Group
- [ ] `asc users list` - List users
- [ ] `asc users get` - Get user
- [ ] `asc users invite` - Invite user
- [ ] `asc users update` - Update user
- [ ] `asc users remove` - Remove user
- [ ] `asc users apps` - Manage user's app access

### `asc actors` Command Group
- [ ] `asc actors list` - List actors
- [ ] `asc actors get` - Get actor

---

## Phase 12: App Clips

### `asc app-clips` Command Group
- [ ] `asc app-clips list` - List app clips
- [ ] `asc app-clips get` - Get app clip
- [ ] `asc app-clips experiences list` - List default experiences
- [ ] `asc app-clips experiences create` - Create default experience
- [ ] `asc app-clips experiences update` - Update default experience
- [ ] `asc app-clips experiences delete` - Delete default experience
- [ ] `asc app-clips advanced list` - List advanced experiences
- [ ] `asc app-clips advanced create` - Create advanced experience

---

## Phase 13: Game Center

### `asc game-center` Command Group
- [ ] `asc game-center enable` - Enable Game Center
- [ ] `asc game-center achievements list` - List achievements
- [ ] `asc game-center achievements create` - Create achievement
- [ ] `asc game-center achievements update` - Update achievement
- [ ] `asc game-center achievements delete` - Delete achievement
- [ ] `asc game-center leaderboards list` - List leaderboards
- [ ] `asc game-center leaderboards create` - Create leaderboard
- [ ] `asc game-center leaderboards update` - Update leaderboard
- [ ] `asc game-center leaderboards delete` - Delete leaderboard
- [ ] `asc game-center leaderboard-sets list` - List leaderboard sets
- [ ] `asc game-center leaderboard-sets create` - Create leaderboard set
- [ ] `asc game-center groups list` - List groups
- [ ] `asc game-center groups create` - Create group
- [ ] `asc game-center matchmaking queues` - Manage matchmaking queues
- [ ] `asc game-center matchmaking rules` - Manage matchmaking rules

---

## Phase 14: Xcode Cloud

### `asc xcode-cloud` Command Group
- [ ] `asc xcode-cloud products list` - List CI products
- [ ] `asc xcode-cloud products get` - Get CI product
- [ ] `asc xcode-cloud workflows list` - List workflows
- [ ] `asc xcode-cloud workflows get` - Get workflow
- [ ] `asc xcode-cloud workflows create` - Create workflow
- [ ] `asc xcode-cloud workflows update` - Update workflow
- [ ] `asc xcode-cloud workflows delete` - Delete workflow
- [ ] `asc xcode-cloud builds list` - List CI builds
- [ ] `asc xcode-cloud builds get` - Get CI build
- [ ] `asc xcode-cloud builds start` - Start CI build
- [ ] `asc xcode-cloud builds cancel` - Cancel CI build
- [ ] `asc xcode-cloud artifacts list` - List build artifacts
- [ ] `asc xcode-cloud artifacts download` - Download artifact

---

## Phase 15: Additional Commands

### `asc sandbox` Command Group
- [ ] `asc sandbox testers list` - List sandbox testers
- [ ] `asc sandbox testers create` - Create sandbox tester
- [ ] `asc sandbox testers delete` - Delete sandbox tester
- [ ] `asc sandbox testers clear-history` - Clear purchase history

### `asc webhooks` Command Group
- [ ] `asc webhooks list` - List webhooks
- [ ] `asc webhooks get` - Get webhook
- [ ] `asc webhooks create` - Create webhook
- [ ] `asc webhooks update` - Update webhook
- [ ] `asc webhooks delete` - Delete webhook

### `asc pre-orders` Command Group
- [ ] `asc pre-orders get` - Get pre-order
- [ ] `asc pre-orders create` - Create pre-order
- [ ] `asc pre-orders update` - Update pre-order
- [ ] `asc pre-orders delete` - Delete pre-order

### `asc pricing` Command Group
- [ ] `asc pricing territories` - List territories
- [ ] `asc pricing points` - List price points
- [ ] `asc pricing schedules` - Manage price schedules

### `asc product-pages` Command Group
- [ ] `asc product-pages list` - List custom product pages
- [ ] `asc product-pages get` - Get product page
- [ ] `asc product-pages create` - Create product page
- [ ] `asc product-pages update` - Update product page
- [ ] `asc product-pages delete` - Delete product page

### `asc encryption` Command Group
- [ ] `asc encryption declarations list` - List encryption declarations
- [ ] `asc encryption declarations get` - Get declaration
- [ ] `asc encryption declarations create` - Create declaration

### `asc merchant-ids` Command Group
- [ ] `asc merchant-ids list` - List merchant IDs
- [ ] `asc merchant-ids get` - Get merchant ID
- [ ] `asc merchant-ids create` - Create merchant ID
- [ ] `asc merchant-ids delete` - Delete merchant ID

### `asc pass-type-ids` Command Group
- [ ] `asc pass-type-ids list` - List pass type IDs
- [ ] `asc pass-type-ids get` - Get pass type ID
- [ ] `asc pass-type-ids create` - Create pass type ID
- [ ] `asc pass-type-ids delete` - Delete pass type ID

### `asc alternative-distribution` Command Group
- [ ] `asc alternative-distribution keys list` - List distribution keys
- [ ] `asc alternative-distribution keys create` - Create distribution key
- [ ] `asc alternative-distribution domains list` - List domains
- [ ] `asc alternative-distribution domains create` - Create domain

### `asc marketplace` Command Group
- [ ] `asc marketplace search-details get` - Get search details
- [ ] `asc marketplace search-details create` - Create search details
- [ ] `asc marketplace webhooks list` - List marketplace webhooks

### `asc app-events` Command Group
- [ ] `asc app-events list` - List app events
- [ ] `asc app-events get` - Get app event
- [ ] `asc app-events create` - Create app event
- [ ] `asc app-events update` - Update app event
- [ ] `asc app-events delete` - Delete app event

### `asc nominations` Command Group
- [ ] `asc nominations list` - List nominations
- [ ] `asc nominations get` - Get nomination
- [ ] `asc nominations create` - Create nomination
- [ ] `asc nominations delete` - Delete nomination

### Utility Commands
- [ ] `asc completion bash` - Generate bash completion
- [ ] `asc completion zsh` - Generate zsh completion
- [ ] `asc completion fish` - Generate fish completion
- [ ] `asc install` - Install/update CLI
- [ ] `asc notify` - Send notifications (Slack, etc.)
- [ ] `asc migrate` - Migration utilities

---

## Phase 16: Type Generation

### OpenAPI Type Generation
- [ ] Create type generator script (`scripts/generate-types.ts`)
- [ ] Generate base types (`src/api/types/base.ts`)
- [ ] Generate app types (`src/api/types/apps.ts`)
- [ ] Generate build types (`src/api/types/builds.ts`)
- [ ] Generate version types (`src/api/types/versions.ts`)
- [ ] Generate testflight types (`src/api/types/testflight.ts`)
- [ ] Generate certificate types (`src/api/types/certificates.ts`)
- [ ] Generate IAP types (`src/api/types/iap.ts`)
- [ ] Generate subscription types (`src/api/types/subscriptions.ts`)
- [ ] Generate remaining types (auto-generated)

---

## Phase 17: Testing

### CLI Tests
- [ ] Argument parsing tests
- [ ] Command routing tests
- [ ] Help generation tests
- [ ] Output formatting tests
- [ ] Global flag tests

### API Tests
- [ ] JWT generation tests
- [ ] HTTP client tests (with mocks)
- [ ] Retry logic tests
- [ ] Pagination tests
- [ ] Error handling tests

### Auth Tests
- [ ] Config file loading tests
- [ ] Environment variable tests
- [ ] Keychain FFI tests (macOS)
- [ ] Credential resolution tests

### Integration Tests
- [ ] End-to-end command tests
- [ ] Output format verification
- [ ] Error message verification

---

## Phase 18: Build & Release

### Build Scripts
- [ ] Create build script for all platforms
- [ ] Set up cross-compilation
- [ ] Add version injection
- [ ] Add build date injection

### Release
- [ ] GitHub Actions workflow
- [ ] Artifact publishing
- [ ] Homebrew formula (optional)
- [ ] npm package (optional)

### Documentation
- [ ] Update README for bun-cli
- [ ] Command reference docs
- [ ] Migration guide from Go CLI
- [ ] Contributing guide

---

## Command Group Mapping (Go -> Bun)

| Go Package | Bun Command | Status |
|------------|-------------|--------|
| `internal/cli/auth` | `asc auth` | [ ] |
| `internal/cli/apps` | `asc apps` | [ ] |
| `internal/cli/builds` | `asc builds` | [ ] |
| `internal/cli/versions` | `asc versions` | [ ] |
| `internal/cli/testflight` | `asc testflight` | [ ] |
| `internal/cli/betaapplocalizations` | `asc beta-app-localizations` | [ ] |
| `internal/cli/betabuildlocalizations` | `asc beta-build-localizations` | [ ] |
| `internal/cli/certificates` | `asc certificates` | [ ] |
| `internal/cli/profiles` | `asc profiles` | [ ] |
| `internal/cli/bundleids` | `asc bundle-ids` | [ ] |
| `internal/cli/devices` | `asc devices` | [ ] |
| `internal/cli/iap` | `asc iap` | [ ] |
| `internal/cli/subscriptions` | `asc subscriptions` | [ ] |
| `internal/cli/offercodes` | `asc offer-codes` | [ ] |
| `internal/cli/winbackoffers` | `asc win-back-offers` | [ ] |
| `internal/cli/promotedpurchases` | `asc promoted-purchases` | [ ] |
| `internal/cli/localizations` | `asc localizations` | [ ] |
| `internal/cli/categories` | `asc categories` | [ ] |
| `internal/cli/agerating` | `asc age-rating` | [ ] |
| `internal/cli/eula` | `asc eula` | [ ] |
| `internal/cli/assets` | `asc assets` | [ ] |
| `internal/cli/routingcoverage` | `asc routing-coverage` | [ ] |
| `internal/cli/submit` | `asc submit` | [ ] |
| `internal/cli/publish` | `asc publish` | [ ] |
| `internal/cli/reviews` | `asc reviews` | [ ] |
| `internal/cli/analytics` | `asc analytics` | [ ] |
| `internal/cli/performance` | `asc performance` | [ ] |
| `internal/cli/finance` | `asc finance` | [ ] |
| `internal/cli/crashes` | `asc crashes` | [ ] |
| `internal/cli/feedback` | `asc feedback` | [ ] |
| `internal/cli/users` | `asc users` | [ ] |
| `internal/cli/actors` | `asc actors` | [ ] |
| `internal/cli/appclips` | `asc app-clips` | [ ] |
| `internal/cli/gamecenter` | `asc game-center` | [ ] |
| `internal/cli/xcodecloud` | `asc xcode-cloud` | [ ] |
| `internal/cli/sandbox` | `asc sandbox` | [ ] |
| `internal/cli/webhooks` | `asc webhooks` | [ ] |
| `internal/cli/preorders` | `asc pre-orders` | [ ] |
| `internal/cli/pricing` | `asc pricing` | [ ] |
| `internal/cli/productpages` | `asc product-pages` | [ ] |
| `internal/cli/encryption` | `asc encryption` | [ ] |
| `internal/cli/merchantids` | `asc merchant-ids` | [ ] |
| `internal/cli/passtypeids` | `asc pass-type-ids` | [ ] |
| `internal/cli/alternativedistribution` | `asc alternative-distribution` | [ ] |
| `internal/cli/marketplace` | `asc marketplace` | [ ] |
| `internal/cli/app_events` | `asc app-events` | [ ] |
| `internal/cli/nominations` | `asc nominations` | [ ] |
| `internal/cli/accessibility` | `asc accessibility` | [ ] |
| `internal/cli/agreements` | `asc agreements` | [ ] |
| `internal/cli/androidiosmapping` | `asc android-ios-mapping` | [ ] |
| `internal/cli/backgroundassets` | `asc background-assets` | [ ] |
| `internal/cli/buildbundles` | `asc build-bundles` | [ ] |
| `internal/cli/buildlocalizations` | `asc build-localizations` | [ ] |
| `internal/cli/prerelease` | `asc prerelease` | [ ] |
| `internal/cli/signing` | `asc signing` | [ ] |
| `internal/cli/completion` | `asc completion` | [ ] |
| `internal/cli/install` | `asc install` | [ ] |
| `internal/cli/notify` | `asc notify` | [ ] |
| `internal/cli/migrate` | `asc migrate` | [ ] |

---

## Notes

- Total endpoints in OpenAPI: **1210**
- Total command groups in Go: **52+**
- Priority: Foundation > Auth > Apps/Builds > TestFlight > Signing > IAP > Rest
- Default output is now pretty-printed; use `--raw` for minified JSON
- macOS Keychain only for initial release; config file fallback for other platforms
