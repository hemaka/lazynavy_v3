# Mobile i18n Migration

Date: 2026-06-11

## Summary

This update ports the V2-style source-text i18n layer into the V3 mobile app and wires the current visible mobile UI to it. The immediate goal was interface text only, so business data, API data, and catalog content remain unchanged unless they are used as direct UI labels.

## i18n Runtime

- Added `I18nProvider`, `useI18n`, `tr`, and `text`.
- The provider reads the signed-in user's `uiLanguage`, falls back to the saved local UI language, and persists manual changes in AsyncStorage.
- The app root wraps mobile screens with `I18nProvider`.
- Source-text translations live in `apps/mobile/src/i18n/translations.ts`.
- English mappings were added for newly migrated interface text; other locales continue to use the existing short locale fallback behavior.

## Migrated Surfaces

- App lock screen.
- Bottom tab labels.
- Login screen and auth modal.
- Profile screen:
  - signed-in profile shell
  - guest profile state
  - avatar and cover image actions
  - iOS photo permission and limited-library sheets
  - media crop sheet
  - badge sheet
  - profile, security, appearance, and privacy settings panels
- Messages screen and chat room screen.
- Chat room fallback labels from `messages/utils/present.ts`.
- Country and region picker.
- Image source action sheet.
- Home HUD accessibility labels and the crew sheet "me" label.

## Language Settings

- Appearance settings now has separate fields for spoken language and interface language.
- Interface language opens a picker backed by the app's supported UI locales.
- Spoken language opens a picker of speech/localization variants.
- Spoken language options display the English language name as the primary title and the local/native text as the secondary line, for example:
  - `Mandarin Chinese` / `普通话`
  - `Cantonese` / `粤语`
  - `Japanese` / `日本語`
  - `Thai` / `ไทย`
- Saving appearance settings updates the local i18n locale immediately after the profile API save completes.

## Build

- Built and installed native iOS Release build `1.0.1.10` to Jim's iPhone.
- The known `devicectl` provider warning appeared during install/launch, but installation and launch succeeded.

## Verification

Validated during implementation:

- `pnpm -C apps/mobile typecheck`
- Scan for direct UI Chinese in `<Text>`, `placeholder`, and `accessibilityLabel` returned no matches.
- Scan for newly added `text(...)` source strings found no missing English mappings.
- Native iOS Release build, install, and launch to Jim's iPhone.
