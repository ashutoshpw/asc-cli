# App Store Connect API 4.4.1 improvements

## Context and repository audit

The repository currently provides a focused Bun/TypeScript CLI for apps,
builds, versions, TestFlight, certificates, profiles, bundle IDs, devices,
users, IAP, subscriptions, analytics, and customer reviews. It does not yet
provide binary build uploads, review-submission resources, or version-scoped
IAP/subscription metadata.

The current API audit found one invalid source route:

- `src/cli/commands/iap/list.ts` uses `/v2/apps/{id}/inAppPurchasesV2`, while
  the current API uses `/v1/apps/{id}/inAppPurchasesV2`.

The current implementation also calls legacy/deprecated resources for IAP and
subscription localizations, subscription availability, and IAP/subscription
submissions. These should be migrated to the versioned resources and unified
review submissions introduced in the current API. The compatibility baseline
is Apple App Store Connect API 4.4.1 and its official OpenAPI specification.

## Implementation backlog

### 1. Compatibility hardening and route contracts — implement now

- Correct the IAP list route.
- Add current sales-report type values, including subscriber, install,
  annual, offer-code, and win-back reports.
- Add a bundle-ID filter while retaining the existing name-filter behavior.
- Keep `ACCESS_TO_REPORTS` readable for existing user data, but reject it for
  new invitations and updates with an actionable deprecation message.
- Add an offline route-contract fixture for API 4.4.1, its source/hash
  metadata, and a Bun validation test/script.
- Prevent use of the deprecated commerce routes migrated by items 2 and 3.

### 2. Versioned IAP and subscription resources — implement now

- Add typed IAP, subscription, and subscription-group version resources.
- Add version list/get/create commands.
- Move localization CRUD to the current v2 localization resources scoped to a
  version.
- Preserve existing localization command names and add `--version-id`.
- Automatically resolve the highest editable version when no version ID is
  supplied; fail clearly when a mutation has no editable version.
- Migrate subscription availability to subscription plan availability,
  including plan type, territory relationships, and new-territory behavior.

### 3. Unified review submissions — implement now

- Add `review-submissions list|get|create|update|submit|cancel`.
- Add review-submission item list/add/resolve/remove operations.
- Support app-store version, IAP version, subscription version, and
  subscription-group version item targets.
- Migrate `iap submit` and `subscriptions submit` to create or reuse a
  `READY_FOR_REVIEW` submission, add the version item idempotently, and submit
  it.
- Support explicit `--version-id` and `--submission-id` overrides.
- Require `--app` when the workflow must find or create a submission; the
  current commerce-owner resources do not expose an app reverse relationship.

### 4. Binary build uploads — implement now

- Extend the API client with raw binary upload operations that support signed
  URLs, PUT requests, offsets, lengths, request headers, timeouts, and
  checksum commits without sending JWT credentials to the signed URL.
- Add `asc builds upload --app --file` with optional `--version`,
  `--build-number`, `--platform`, `--wait`, and `--timeout` options.
- Inspect IPA `Payload/*.app/Info.plist` files and PKG XAR `PackageInfo`
  metadata when explicit values are missing.
- Support IPA and PKG primary assets; leave description/SPI assets and
  metadata-image upload commands for follow-up work.
- Return after upload commit by default. With `--wait`, poll upload state and
  then the related build until valid, failed/invalid, or timeout.

## Follow-up backlog

- Versioned IAP/subscription screenshots, localization assets, app metadata,
  and background-asset uploads.
- Remaining API 4.4 analytics metrics and metric goals, including STORAGE and
  ANIMATION workflows.
- Webhook notification configuration and event handling.
- TestFlight beta-build localizations, feedback, metrics, and expanded build
  relationships.
- App events, custom product pages, experiments, Game Center resources, and
  updated age-rating workflows.

## Acceptance criteria

- Existing command names, authentication configuration, output formatting,
  and compatible flags continue to work.
- All routes used by source commands are present in the pinned 4.4.1 route
  contract, and migrated deprecated routes are absent.
- New request bodies use the official JSON:API resource and relationship
  types.
- IPA/PKG inspection, upload chunking, checksum commit, signed-request
  authentication, state polling, and timeout behavior are covered by mocked
  tests and local fixtures.
- No test requires live Apple credentials or a live App Store Connect API.
- `bun run lint`, `bun run typecheck`, `bun test`, `bun run test:coverage`,
  `bun run build`, `bun run build:all`, and `bun run check` pass.
- README and CHANGELOG document the new commands and compatibility changes.

## Sources

- Apple App Store Connect API 4.4.1 release notes:
  https://developer.apple.com/documentation/appstoreconnectapi/app-store-connect-api-4-4-1-release-notes
- Apple App Store Connect API 4.4 release notes:
  https://developer.apple.com/documentation/appstoreconnectapi/app-store-connect-api-4-4-release-notes
- Official OpenAPI specification:
  https://developer.apple.com/sample-code/app-store-connect/app-store-connect-openapi-specification.zip
- Review submissions:
  https://developer.apple.com/documentation/appstoreconnectapi/review-submissions
- Build uploads:
  https://developer.apple.com/documentation/appstoreconnectapi/build-uploads
