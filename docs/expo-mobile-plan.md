# Expo Mobile Plan (Web + Native)

This repository currently ships a Vite + OpenLayers web app to GitHub Pages.
This plan prepares the project for an Expo mobile app while keeping the existing web app.

## Source references used

- https://docs.expo.dev/get-started/create-a-project/
- https://docs.expo.dev/router/introduction/
- https://docs.expo.dev/workflow/using-libraries/
- https://docs.expo.dev/deploy/web/

## Target architecture

- Keep current web app as-is (Vite + OpenLayers + GitHub Pages).
- Add a new Expo app in `mobile/` for Android and iOS.
- Share non-UI domain logic between web and mobile over time (parsing, filtering, API helpers).

## Recommended phases

### Phase 1: Bootstrap Expo app in this repo

```bash
npm run mobile:init
cd mobile
npx expo start
```

Notes:
- Uses `create-expo-app` with `default@sdk-57` template.
- Prefer Expo Router for file-based routes and deep linking.
- Start in Expo Go first, then move to development builds when native modules are needed.

### Phase 2: Mobile MVP strategy

Choose one path:

1. Fastest delivery: WebView wrapper
- Use `react-native-webview` to host the existing GitHub Pages map app inside mobile.
- Pros: immediate parity with current web map.
- Cons: lower native UX and accessibility fidelity.

2. Native map screen
- Use a React Native map library and consume WMS data/services directly.
- Move search, feature parsing, and accessibility scoring logic into shared JS modules.
- Pros: better native performance and UX.
- Cons: larger migration effort.

### Phase 3: Shared core module

Move pure utilities into a shared package (or shared folder), for example:

- XML/GML parsing
- feature filtering/scoring
- API URL builders
- escaping/sanitization helpers

This repo already has an initial extraction in `map-utils.js` with tests.

### Phase 4: Delivery and deployment

- Web: continue GitHub Pages from this root project.
- Mobile: use EAS for builds and store submission.
- Optional Expo web hosting for the mobile Expo app's web target:

```bash
cd mobile
npx expo export --platform web
eas deploy --prod
```

## Compatibility notes

- Install mobile packages with `npx expo install` in the Expo project to keep version compatibility.
- Validate third-party React Native packages against React Native Directory and Expo docs.
- If a package needs native configuration, use development builds instead of Expo Go.

## Immediate next technical tasks

1. Create `mobile/` and verify `npx expo start` runs on iOS simulator.
2. Build a `mobile/app/(tabs)/index.tsx` screen with search + list first.
3. Add a map screen and integrate Geonorge endpoints.
4. Share parser/filter utilities between web and mobile.
5. Add CI for `npm run check` in this web app and Expo checks in `mobile/`.
