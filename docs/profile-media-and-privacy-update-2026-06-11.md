# Profile Media and Privacy Update

Date: 2026-06-11

## Summary

This update moves profile avatar and cover image changes from local device file storage to server-backed uploads. It also adds the V3 profile settings menus, app lock controls, iOS limited photo library handling, and fixes the home HUD avatar refresh path.

## API

- Added authenticated `POST /api/media/upload`.
- Registered multipart upload support with an 8 MB single-file limit.
- Registered static serving under `/uploads/`.
- Uploaded files are stored outside the synced app tree by default at `$HOME/LazyNavyUploads`, or `UPLOADS_DIR` when provided. This prevents `rsync --delete` deploys from deleting uploaded user media.
- Home HUD now returns `user.avatar ?? user.avatarUrl` so the uploaded avatar is the primary display image.

## Mobile Profile

- Tapping the profile avatar opens avatar media selection.
- Tapping the profile cover opens cover media selection.
- Selected/captured media enters the full-screen crop step before upload:
  - avatar uses a circular crop frame
  - cover uses a rectangular 16:9 crop frame
  - gesture pan and pinch zoom are supported
- Cropped media is uploaded to the server, then the returned URL is saved to `/users/me`.
- The profile screen refreshes the auth user after upload, so current-session user data is updated.

## iOS Photo Access

The photo picker follows iOS permission state instead of using the permissionless PHPicker flow:

- `None`: the in-app photo sheet shows an unavailable state with a `去设置` button that opens the app's iOS Settings page.
- `Limited`: the in-app sheet lists only currently accessible photos.
- The last grid item in limited mode is `添加更多可访问照片`; tapping it calls the system limited-access expansion UI.
- `PHPhotoLibraryPreventAutomaticLimitedAccessAlert` is enabled so iOS does not automatically show the limited-library expansion alert when the app opens the photo sheet.
- After adding more accessible photos, the sheet silently refreshes several times and listens for media library changes so newly granted photos appear without a full-grid loading flash.

## Profile Menus

The profile page now includes:

- 我的资料: nickname, bio, gender, birthday, country/region, language, privacy basics.
- 安全: 2FA placeholder, app protection password, Face ID / fingerprint toggles where supported.
- 界面设置: color theme, speech language, UI language.
- 隐私设置: visibility, add/search controls, location policy, visible fields.
- Version text below the logout button.

App protection settings are currently stored locally via AsyncStorage and enforced when the app returns from background. Disabling protection requires entering the current protection password.

## Home HUD Avatar

The home HUD request now includes the current logged-in `userId`. This prevents the home screen from falling back to the dev user and ensures the avatar in the home info bar matches the profile avatar. The home screen also refreshes HUD data on focus.

## Verification

Validated during implementation:

- `pnpm --filter @lazynavy-v3/mobile typecheck`
- `pnpm --filter @lazynavy-v3/api typecheck`
- `pnpm --filter @lazynavy-v3/api build`
- staging API deploy and health check
- native iOS Release build and install to Jim's iPhone

