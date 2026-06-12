# POI V2 Sync, Notes, and Reviews

Date: 2026-06-12

## Summary

This update moves the V3 POI model closer to the V2 place requirements, syncs rich legacy place data into V3, and brings POI notes and reviews back into the mobile map detail experience.

## Legacy Place Sync

- Added a legacy MySQL place sync script at `apps/api/src/scripts/sync-legacy-places.ts`.
- Added `pnpm --filter @lazynavy-v3/api sync:legacy-places`.
- The script reads V2 `places` rows from MySQL or a JSON export and maps the rich V2 payload into V3 POI fields.
- Synced V2-style data includes kind/category/subtype, region/country/address, phone, source URL, picture, timezone, rating, best months, raw payloads, and berthing details.
- The latest local and staging sync covered 29,810 POIs.

## POI Schema

The V3 `Poi` schema now stores V2-derived place fields directly:

- `kind`, `category`, `categoryGroup`, `subtype`
- `legacySource`, `legacyUuid`, `legacyExId`, `legacyStatus`
- `slug`, `region`, `country`, `address`, `phone`, `sourceUrl`, `picture`, `timezone`
- `rating`, `commentsCount`, `bestMonths`
- `sourcePayload`, `infoPayload`, `extraPayload`
- soft-delete and sync metadata

Berthing-specific attributes live in `PoiBerthing`, including draft/length/beam limits, seabed, protection directions, mooring types, amenities, booking, fees, and overnight flags.

## Notes and Reviews

Added real database-backed V2-style models:

- `PoiNote`
  - logged-in users can add `info` or `warning` notes
  - notes are listed when published/highlighted and not soft-deleted
  - users can soft-delete their own notes
  - pinned and confirmed notes sort first
- `PoiReview`
  - one review per user per POI
  - rating must be 1-5
  - upsert updates the user's existing review
  - deleting a review recomputes POI aggregate stats
- `PoiFavorite`
  - replaces the previous favorite endpoint stubs with real persisted favorites

The API now exposes real implementations for:

- `GET /api/pois/:id/notes`
- `POST /api/pois/:id/notes`
- `DELETE /api/pois/:id/notes/:noteId`
- `GET /api/pois/:id/reviews`
- `GET /api/pois/:id/reviews/me`
- `POST /api/pois/:id/reviews`
- `DELETE /api/pois/:id/reviews/me`
- `GET/POST/DELETE /api/pois/:id/favorite`
- `GET /api/pois/mine/favorites`

Write endpoints use JWT auth.

## Mobile Map Detail

- POI details open in the map as a full-screen sheet rather than navigating away.
- The bottom tab bar hides while the full-screen detail is open and returns after dismiss.
- Pulling down from the top closes the full-screen detail and clears the selected POI card.
- The full-screen POI screen now has V2-style review and note behaviors:
  - detail tab includes `NOTES · 备注与提醒`
  - users can add normal or warning notes
  - users can delete their own notes
  - review tab shows aggregate rating, review count, star input, comment input, and review list
  - submitting a review refreshes POI aggregate rating and comment count
- Anchorage protection is shown graphically with a compass-style direction view.
- POI detail content is type-aware so anchorage, marina, buoy mooring, public quay, dry dock, and hazard POIs do not show irrelevant fields.

## Staging Deploy

Staging API was deployed to `/home/forge/LazyNavy`.

Deployment steps completed:

- synced API Prisma schema, migrations, places module, scripts, package file, and lockfile
- ran `pnpm --filter @lazynavy-v3/api exec prisma migrate deploy`
- ran `pnpm --filter @lazynavy-v3/api exec prisma generate`
- ran `pnpm --filter @lazynavy-v3/api build`
- restarted PM2 process `lazynavy-api`
- verified `https://api.staging.lazynav.com/api/health` returned HTTP 200

## Device Build

Installed to Jim's iPhone with the bundled build skill.

- Version: `1.0.1.6`
- API URL: `https://api.staging.lazynav.com/api`
- Mobile typecheck: passed
- iOS Release build: succeeded
- Device install: succeeded
- Device launch: succeeded

The `devicectl` provider warning appeared during install/launch, but it was non-blocking.

## Verification

Validated locally:

- `pnpm --filter @lazynavy-v3/api exec prisma generate`
- `pnpm --filter @lazynavy-v3/api typecheck`
- `pnpm --filter @lazynavy-v3/mobile typecheck`
- `pnpm --filter @lazynavy-v3/api exec prisma migrate deploy`
- `pnpm --filter @lazynavy-v3/api build`

Validated on staging:

- `pnpm --filter @lazynavy-v3/api exec prisma migrate deploy`
- `pnpm --filter @lazynavy-v3/api exec prisma generate`
- `pnpm --filter @lazynavy-v3/api build`
- PM2 restart and health check
