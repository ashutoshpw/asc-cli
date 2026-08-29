# Changelog

All notable changes to this project will be documented here.

## Unreleased

- Added the repository quality, security, and release automation foundation.
- Updated API route compatibility to App Store Connect API 4.4.1, including
  current sales report types, app bundle-ID filtering, and user-role validation.
- Added versioned IAP, subscription, and subscription-group commands with
  version-scoped localization CRUD and subscription plan availability.
- Added unified review-submission and item workflows, including idempotent
  `iap submit` and `subscriptions submit` behavior.
- Added `asc builds upload` for IPA and PKG files with package inspection,
  signed binary delivery, SHA-256 commit, and opt-in processing waits.
