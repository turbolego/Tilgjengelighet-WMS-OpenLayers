# Mobile App Build Guide

This repository supports multiple ways to build the mobile app (Expo):

## 1. Local Development (Recommended)
For day-to-day development, use Expo's development client:
```bash
cd mobile
npm start          # or: npx expo start
# Then press 'a' for Android emulator or 'i' for iOS simulator
# Or scan QR code with Expo Go app on physical device
```

## 2. Continuous Native Generation (CNG) - CI/CD Friendly
This approach works in **GitHub Actions without any Expo account or tokens** and builds standalone APK/.app files.

### How It Works
1. `npx expo prebuild --platform <android|ios> --clean` generates native projects
2. Build with standard tools:
   - Android: `./gradlew assembleRelease` (produces APK)
   - iOS: `xcodebuild` (produces .app bundle for simulator; requires macOS)

### GitHub Actions
The `.github/workflows/mobile-build.yml` workflow implements CNG:
- **Android**: Runs on Ubuntu, produces `android-apk` artifact
- **iOS**: Requires macOS runner (trigger manually via workflow_dispatch), produces `ios-app` artifact

**To trigger manually:**
1. Go to Actions tab → Mobile Build workflow
2. Click "Run workflow"
3. Select platform (android/ios)
3. Click "Run workflow"

### Artifacts
Built binaries are uploaded as workflow artifacts:
- Android: `mobile/android/app/build/outputs/apk/release/*.apk`
- iOS: `mobile/ios/build/*-iphonesimulator/*.app`

## 3. Expo Application Services (EAS) - Cloud Builds
Requires an Expo account and token. Use when you need:
- App Store/Play Store submission (.aab/.ipa)
- Over-the-air updates
- Automatic versioning
- Credential management

### Setup
1. Create Expo account: https://expo.dev/signup
2. Generate access token: https://expo.dev/settings/access-tokens
3. Add token as GitHub secret:
   - Settings → Secrets and variables → Actions
   - New repository secret: `EXPO_TOKEN` = your token
4. The `.github/workflows/mobile-eas.yml` workflow will then run automatically on push

### EAS Commands (Manual)
```bash
# Login (not needed in CI with token)
eas login

# Build preview
eas build --platform all --preview

# Build production
eas build --platform android --production
eas build --platform ios --production

# Submit to stores
eas submit --platform android --latest
eas submit --platform ios --latest
```

## Configuration Files

### app.json
Defines app identity and platform icons:
- `ios.bundleIdentifier`: Set to `no.geonorge.tilgjengelighet`
- `android.package`: Set to `no.geonorge.tilgjengelighet`
- Icons: Uses adaptive icons (Android) and Expo icon format (iOS)

### eas.json
Build profiles for EAS cloud builds:
- **development**: Debug builds, internal distribution
- **preview**: Release builds, internal distribution (QA/test)
- **production**: Release builds, store distribution (.aab/.ipa)

## Troubleshooting

### MapLibre vs Google Maps

This app uses **@maplibre/maplibre-react-native** instead of react-native-maps with Google Maps. This means:
- ✅ **No Google Maps API key required** — MapLibre is free and open source
- ✅ **No API key configuration needed** — works out of the box
- ✅ Uses OpenFreeMap base tiles (free, no registration)
- ✅ WMS overlay from Geonorge's public service
- ❌ Not supported in Expo Go (uses development builds only)

### Android Build Issues
- Ensure Android SDK is installed (GitHub Action `setup-android` handles this)
- JAVA_HOME must be set (GitHub Action `setup-java` handles this)
- Gradle wrapper permissions: `chmod +x android/gradlew`
- The first build may take 10+ minutes as Gradle downloads MapLibre native dependencies

### Missing EXPO_TOKEN
If you see `An Expo user account is required to proceed` in logs:
- The EAS workflow is correctly skipping itself when token is missing
- Use the Mobile Build workflow (CNG approach) instead
- To enable EAS: Add EXPO_TOKEN secret as described above

### iOS Build Issues
- Requires macOS runner (GitHub Actions provides macOS-latest)
- CocoaPods must be installed (`pod install`)
- For device builds: Need Apple Developer account and proper signing
- Simulator builds work without signing (as configured in workflow)

## Why This Approach?
- **No token required**: CNG works with just Node.js and platform SDKs
- **Transparent builds**: You control the entire build process
- **Fast iteration**: Local development uses Expo dev client
- **Flexible**: Switch between local, CNG CI, and EAS cloud as needed

---
*Last updated: $(date)*