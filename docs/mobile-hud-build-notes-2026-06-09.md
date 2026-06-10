# Mobile HUD Build Notes - 2026-06-09

## Scope

- Reworked the V3 mobile home screen toward the provided Captain HUD reference.
- Added the generated iOS native project so the app can be installed directly on a physical iPhone with the V2-style local build flow.
- Kept the HUD background asset inside the mobile app at `apps/mobile/src/assets/hud_bg_1.png`.

## Home HUD

- The home screen uses `hud_bg_1.png` as the full-screen scene background.
- Background height follows the device screen height; width is derived from the asset aspect ratio and is allowed to overflow horizontally instead of being compressed.
- Top player information, weather chips, side buttons, lower alert, and bottom navigation are all offset from safe area values.
- Top player information uses a 44pt capsule, a 64pt round avatar, a right-side round badge inside the capsule, and a separate 44pt round message button aligned to the same shared content inset.
- The top message icon is drawn as a flat line-style chat bubble. Do not use dimensional emoji for this control.
- The old crew strip was replaced with a compact vessel information card:
  - left: vessel photo/logo placeholder
  - center: vessel nickname and registered/title text
  - right: captain avatar
- Tapping the captain avatar opens a member sheet. Captain users see an Invite action.
- The voyage review alert stays above the bottom navigation.

## Mobile UI Shape Rules

- Icon-only controls should be circular and at least 44pt by 44pt.
- Fixed-height pills and cards should use a radius equal to half their height.
- Bottom navigation, selected bottom-nav items, vessel information cards, alert rows, and compact action buttons should use capsule geometry when their height is fixed.
- Notification dots sit at the top-right edge of their circular target, overlapping the edge instead of floating fully outside.
- Home HUD horizontal spacing should come from a shared content inset where possible; avoid one-off left and right offsets for paired controls.

## Runtime Notes

- Mobile API requests now use an 8 second timeout so the HUD can fall back quickly when the API is unavailable.
- `newArchEnabled` is disabled for iOS to match the working V2-style device build path and avoid the previous blank-screen behavior.
- `expo-linking` is included because Expo Router requires the native module on device builds.

## Device Build

Known working V2-style native iOS Release build command from `apps/mobile`:

```bash
APP_ENV=production EXPO_PUBLIC_API_URL='https://api.staging.lazynav.com/api' pnpm exec expo run:ios --device 00008150-001938A222C0401C --configuration Release
```

Most recent result:

- Build configuration: `Release`.
- Product directory: `Build/Products/Release-iphoneos`.
- App bundle: `LazyNavyV3.app`.
- Device UUID: `00008150-001938A222C0401C`.
- Result: build succeeded, installed to the device, and launched.
- Non-blocking warning: `Unexpected devicectl JSON version output from devicectl`.
- Non-blocking warnings: deployment target warnings for `RNCAsyncStorage` and `react-native-maps`.

## Current Mobile Shell Notes

- Bottom navigation is `首页`, `Map`, `Log`, `我的`.
- The `我的` page is the personal center, not Toolbox.
- Home has a top-right message icon that opens a full-screen floating message overlay.
- The message overlay is independent of the current route and closes back to the previous page.
- Home/Profile/Map surfaces keep the bottom navigation visible.
- The Map tab uses the V3 map surface with bottom navigation.
