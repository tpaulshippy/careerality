# App Store Deployment Guide

This document outlines the steps required to deploy Careerality to the Apple App Store and Google Play Store.

---

## Pre-requisites

Before starting, ensure you have:

- Apple Developer Account ($99/year)
- Google Play Developer Account ($25 one-time)
- Node.js 18+ installed
- Xcode installed (macOS only)
- Android Studio installed

---

## Phase 1: App Configuration

### 1.1 Update app.json / app.config.js

Ensure these fields are configured:

```json
{
  "expo": {
    "name": "Careerality",
    "slug": "careerality",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "bundleIdentifier": "com.careerality.app",
      "buildNumber": "1",
      "supportsTablet": true,
      "infoPlist": {
        "NSCameraUsageDescription": "We need camera access for profile photos",
        "NSPhotoLibraryUsageDescription": "We need photo library access for profile photos"
      }
    },
    "android": {
      "package": "com.careerality.app",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ]
    }
  }
}
```

### 1.2 Generate App Icons

Create icon sizes for both platforms:

- **iOS**: 1024x1024 (App Store), @2x/@3x variants
- **Android**: 512x512 (Play Store), adaptive icons

Use a tool like `expo-icon-generator` or create manually.

---

## Phase 2: Build Preparation

### 2.1 Install EAS CLI

```bash
npm install -g eas-cli
```

### 2.2 Configure EAS Build

Create `eas.json` in project root:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "distribution": "store"
      }
    }
  }
}
```

### 2.3 Login to EAS

```bash
eas login
```

### 2.4 Configure Build Credentials

**For iOS:**
```bash
eas credentials
```

**For Android:**
```bash
eas credentials --platform android
```

---

## Phase 3: iOS App Store Deployment

### 3.1 Create Apple Developer Account

If you don't have one:
1. Visit [developer.apple.com](https://developer.apple.com)
2. Enroll in Apple Developer Program ($99/year)

### 3.2 Generate iOS Native Project

```bash
cd client
npx expo prebuild --platform ios
```

This generates the `ios/` directory.

### 3.3 Configure Xcode Project

1. Open `ios/Careerality.xcworkspace` in Xcode
2. Set up your Team in Signing & Capabilities
3. Verify Bundle Identifier matches `app.json`

### 3.4 Build with EAS

```bash
eas build --platform ios --profile production
```

### 3.5 Submit to App Store

1. Download the build from EAS
2. Open [App Store Connect](https://appstoreconnect.apple.com)
3. Create a new app entry
4. Upload the build using Transporter (macOS) or altool
5. Fill in app metadata:
   - App name and description
   - Screenshots (iPhone 6.7", 6.5", 5.5")
   - Keywords
   - Support URL
   - Privacy Policy URL
6. Submit for review

### 3.6 App Store Review Guidelines

Ensure compliance with [Apple Review Guidelines](https://developer.apple.com/app-store-review-guidelines/):
- No crashes or bugs
- Functional sign-up/login (or clear guest access)
- Privacy policy URL required
- No placeholder content
- Appropriate content ratings

---

## Phase 4: Google Play Store Deployment

### 4.1 Create Google Play Developer Account

If you don't have one:
1. Visit [play.google.com/console](https://play.google.com/console)
2. Pay one-time $25 registration fee

### 4.2 Generate Android Native Project

```bash
cd client
npx expo prebuild --platform android
```

This generates the `android/` directory.

### 4.3 Configure Android Project

1. Open `android/app/build.gradle`
2. Set `applicationId` to `com.careerality.app`
3. Configure signing (or use EAS-managed)

### 4.4 Build with EAS

```bash
eas build --platform android --profile production
```

### 4.5 Submit to Google Play

1. Go to [Google Play Console](https://play.google.com/console)
2. Create a new app
3. Upload the `.aab` file
4. Fill in store listing:
   - App title and description
   - Screenshots (phone, 7" tablet, 10" tablet)
   - Feature graphic
   - Privacy policy
5. Complete content rating questionnaire
6. Select countries and pricing
7. Submit for review

### 4.6 Google Play Review

Google Play is typically faster than Apple:
- Automated checks complete in hours
- Human review takes 1-7 days
- Ensure no policy violations

---

## Phase 5: Store Listing Assets

### 5.1 Required Screenshots

| Platform | Size | Count |
|----------|------|-------|
| iOS (Phone) | 6.7" (1242x2688) or 6.5" (1242x2208) | Min 2 |
| iOS (Tablet) | 12.9" (2048x2732) | Optional |
| Android (Phone) | 1080x1920 | Min 2 |
| Android (Tablet) | 2048x1536 | Optional |

### 5.2 App Preview Videos (Optional)

- iOS: 15-30 second preview
- Android: Optional app trailer

### 5.3 Store Listing Content

Prepare:
- **Short description** (30 chars for Google, 30 chars for iOS)
- **Full description** (4000 chars Google, 5800 chars iOS)
- **Keywords** (100 char limit iOS)
- **Privacy Policy URL** (required for both)
- **Support URL**

---

## Phase 6: Post-Launch

### 6.1 Set Up Analytics

Configure crash reporting and analytics:

```bash
# Recommended: Sentry for error tracking
npm install @sentry/react-native
```

### 6.2 Set Up App Updates

Use EAS Update for minor updates without app store review:

```bash
eas update --channel production
```

### 6.3 Monitor Reviews

- Set up alerts for new reviews
- Respond promptly to user feedback
- Track ratings and reviews over time

---

## Checklist

### Pre-Build
- [ ] Update app.json with correct bundle identifiers
- [ ] Generate app icons for all platforms
- [ ] Configure EAS credentials
- [ ] Test app on physical devices

### iOS
- [ ] Apple Developer Account active
- [ ] Bundle identifier configured
- [ ] Screenshots prepared
- [ ] Privacy policy published
- [ ] Build submitted via EAS
- [ ] App metadata filled in
- [ ] Submitted for review

### Android
- [ ] Google Play Developer Account active
- [ ] Package name configured
- [ ] Screenshots prepared
- [ ] Privacy policy published
- [ ] AAB build submitted
- [ ] App metadata filled in
- [ ] Submitted for review

---

## Troubleshooting

### Common Issues

**Build fails with missing credentials:**
- Run `eas credentials` to configure
- Ensure Apple ID has App Manager or Admin role

**App rejected for missing privacy policy:**
- Publish a privacy policy on your website
- Add URL to app.json and store listing

**Android build fails with SDK error:**
- Ensure `android/build.gradle` has correct SDK versions
- Check `compileSdkVersion` and `targetSdkVersion`

**iOS simulator build works but App Store fails:**
- Ensure all required architectures are included
- Check for missing frameworks or libraries

---

## Resources

- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Google Play Console Help](https://developer.android.com/distribute/console)
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store-review-guidelines/)
- [Google Play Developer Program Policies](https://play.google/about/developer-content-policy/)

---

*Last updated: March 2026*
