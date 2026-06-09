# Mobile HUD Build Notes - 2026-06-09

## Scope

- Reworked the V3 mobile home screen toward the provided Captain HUD reference.
- Added the generated iOS native project so the app can be installed directly on a physical iPhone with the V2-style local build flow.
- Kept the HUD background asset inside the mobile app at `apps/mobile/src/assets/hud_bg_1.png`.

## Home HUD

- The home screen uses `hud_bg_1.png` as the full-screen scene background.
- Background height follows the device screen height; width is derived from the asset aspect ratio and is allowed to overflow horizontally instead of being compressed.
- Top player information, weather chips, side buttons, lower alert, and bottom navigation are all offset from safe area values.
- The old crew strip was replaced with a compact vessel information card:
  - left: vessel photo/logo placeholder
  - center: vessel nickname and registered/title text
  - right: captain avatar
- Tapping the captain avatar opens a member sheet. Captain users see an Invite action.
- The voyage review alert stays above the bottom navigation.

## Runtime Notes

- Mobile API requests now use an 8 second timeout so the HUD can fall back quickly when the API is unavailable.
- `newArchEnabled` is disabled for iOS to match the working V2-style device build path and avoid the previous blank-screen behavior.
- `expo-linking` is included because Expo Router requires the native module on device builds.

## Device Build

Known working build command from `apps/mobile`:

```bash
APP_ENV=production EXPO_PUBLIC_API_URL='https://api.staging.lazynav.com/api' pnpm exec expo run:ios --device 00008150-001938A222C0401C --configuration Release
```

If Expo's install step stalls, install the produced app directly with CoreDevice:

```bash
xcrun devicectl device install app --device CBC877A1-1CB4-5AF3-B7C9-06B4A7E75896 /Users/jim/Library/Developer/Xcode/DerivedData/LazyNavyV3-fozoloecutpdrkdexaxfxjhjrwcw/Build/Products/Release-iphoneos/LazyNavyV3.app
```

## Pending

- The Map tab still needs the V2 map module ported into V3 in a separate change.
- After adding the V2 map module, install and verify the required native/web map dependencies before the next phone build.
