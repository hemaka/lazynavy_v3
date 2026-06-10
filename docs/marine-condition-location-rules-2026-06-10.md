# Marine Condition and Location Recording Rules

## Scope

This document records the first implementation rules for marine condition lookup, local location recording, shore visit tracking, and vessel presence detection.

The design separates GPS sampling from downstream consumers:

- GPS samples are collected by the mobile app.
- `LocationEngine` decides whether a sample should become a stored location point.
- Marine condition refreshes are triggered from the same GPS sample stream.
- Location points are persisted locally first, then queued for sync.
- Marine conditions are stored server-side in `MarineCondition`.

## Server-Controlled Client Config

The mobile app receives runtime thresholds from `clientConfig` in `GET /users/me`, login, and register responses.

Defaults are controlled by environment variables:

```env
MARINE_CONDITION_REFRESH_INTERVAL_MINUTES=15
MARINE_CONDITION_REFRESH_DISTANCE_KM=5
VOYAGE_LOCATION_MIN_INTERVAL_SECONDS=5
VOYAGE_LOCATION_MIN_DISTANCE_METERS=15
VOYAGE_LOCATION_MAX_INTERVAL_SECONDS=60
VOYAGE_LOCATION_MAX_ACCURACY_METERS=50
ASHORE_LOCATION_MIN_INTERVAL_SECONDS=30
ASHORE_LOCATION_MIN_DISTANCE_METERS=25
ASHORE_LOCATION_MAX_INTERVAL_SECONDS=300
ASHORE_LOCATION_MAX_ACCURACY_METERS=75
LEAVE_VESSEL_DISTANCE_METERS=80
RETURN_VESSEL_DISTANCE_METERS=40
LEAVE_VESSEL_GRACE_SECONDS=180
```

This allows tuning the mobile behavior without requiring an app update.

## Location Sampling

The app uses a single foreground GPS watcher. Features should consume samples through `LocationEngine` rather than starting independent GPS watchers.

Current watcher hints:

- Balanced accuracy.
- 5 second time interval.
- 5 meter distance interval.
- Foreground only.
- Web is skipped.

The watcher frequency is not the storage frequency. Storage is decided by thresholds.

## Voyage Location Rules

Voyage mode is used when the HUD reports an active voyage.

Default behavior:

- Reject points with accuracy worse than 50 meters.
- Record after at least 5 seconds and 15 meters of movement.
- Record at least once every 60 seconds even if movement is small.

The max interval keeps anchored, slow, or dock-side periods from having no track points.

## Ashore Location Rules

Ashore mode is used when there is no active voyage.

Default behavior:

- Reject points with accuracy worse than 75 meters.
- Record after at least 30 seconds and 25 meters of movement.
- Record at least once every 300 seconds even if movement is small.

This supports shore visit history while keeping battery and storage usage lower than voyage mode.

## Vessel Presence Rules

Presence detection compares the user location to the vessel location when the app has a vessel reference point.

Defaults:

- Within 40 meters: mark onboard.
- Beyond 80 meters for 180 seconds: mark ashore.
- Between 40 and 80 meters: keep the previous state.

The separate leave and return distances reduce GPS jitter around docks and marinas.

## Marine Condition Rules

Marine conditions are only refreshed in voyage mode.

Defaults:

- Refresh when the last marine condition is older than 15 minutes.
- Refresh when the user has moved at least 5 km since the last marine condition refresh.

Server-side `MarineCondition` keys:

- `latBucket`
- `lngBucket`
- `timeBucket`
- `source`

Current bucket rules:

- Coordinate bucket: 2 decimal places.
- Time bucket: 15 minutes.
- Default source: `open_meteo`.

The server first checks `MarineCondition`; if no row exists, it fetches Open-Meteo Forecast API and Marine API data, normalizes fields, and upserts the row.

## Local Persistence

Accepted location points are written to local SQLite table `location_points`.

Stored fields include:

- User, vessel, voyage.
- Mode: `voyage` or `ashore`.
- Presence status.
- Latitude and longitude.
- Accuracy, speed, heading, altitude.
- Recorded time.
- Sync status.
- Quality.

Each stored point is also enqueued into `pending_updates` as entity `location_point`.

## Current Limitations

- Background location recording is not enabled yet.
- The generic sync endpoint currently receives location point mutations, but there is not yet a dedicated server `LocationPoint` business table.
- Vessel presence detection is ready for a vessel reference point, but the current provider does not yet hydrate a precise vessel location.
- Marine condition historical backfill for voyage replay is not implemented yet.
