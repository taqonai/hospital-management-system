# HMS Patient Portal - Deployment Guide

## Prerequisites

1. **Expo Account**: Create an account at [expo.dev](https://expo.dev)
2. **EAS CLI**: Install globally with `npm install -g eas-cli`
3. **Apple Developer Account**: Required for iOS builds ($99/year)
4. **Google Play Developer Account**: Required for Android builds ($25 one-time)

## Initial Setup

### 1. Login to EAS

```bash
eas login
```

### 2. Configure Project

```bash
# Initialize EAS in your project (if not already done)
eas init

# This will create/update your project on Expo servers
# and provide you with a project ID
```

### 3. Update Configuration

Update the following in `app.json`:
- `extra.eas.projectId`: Your EAS project ID
- `owner`: Your Expo username

Update `eas.json`:
- `submit.production.ios.appleId`: Your Apple ID
- `submit.production.ios.ascAppId`: App Store Connect App ID
- `submit.production.ios.appleTeamId`: Your Apple Team ID

## Environment Variables

Set these in your EAS project settings or as secrets:

| Variable | Description |
|----------|-------------|
| `API_URL` | Production API URL |
| `SENTRY_DSN` | Sentry error tracking DSN |
| `EXPO_PUBLIC_*` | Public environment variables |

## Building the App

### Development Build (for testing)

```bash
# iOS Simulator
eas build --profile development --platform ios

# Android APK
eas build --profile development --platform android
```

### Preview Build (internal testing)

```bash
# Both platforms
eas build --profile preview --platform all

# Or individually
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

### Production Build

```bash
# Both platforms
eas build --profile production --platform all

# iOS only (for App Store)
eas build --profile production --platform ios

# Android only (for Play Store)
eas build --profile production --platform android
```

## App Store Submission

### iOS (App Store Connect)

1. **Create App in App Store Connect**
   - Log in to [App Store Connect](https://appstoreconnect.apple.com)
   - Create a new app with your bundle ID
   - Fill in app information

2. **Submit via EAS**
   ```bash
   eas submit --platform ios --latest
   ```

3. **Complete App Store Listing**
   - Add screenshots (use store-listing.md for specs)
   - Add app description
   - Set age rating
   - Configure pricing

4. **Submit for Review**
   - Apple reviews typically take 24-48 hours

### Android (Google Play Store)

1. **Create App in Play Console**
   - Log in to [Google Play Console](https://play.google.com/console)
   - Create a new app
   - Complete store listing

2. **Create Service Account**
   - Go to Google Cloud Console
   - Create a service account with Play Console access
   - Download the JSON key file
   - Save as `google-service-account.json`

3. **Submit via EAS**
   ```bash
   eas submit --platform android --latest
   ```

4. **Complete Play Store Listing**
   - Add screenshots
   - Add feature graphic (1024x500)
   - Complete data safety form
   - Set content rating

5. **Release**
   - Start with Internal Testing
   - Then move to Closed/Open Beta
   - Finally, Production release

## Over-the-Air (OTA) Updates

For JavaScript-only updates (no native code changes):

```bash
# Create an update for production
eas update --branch production --message "Bug fixes and improvements"

# Create an update for preview
eas update --branch preview --message "New feature testing"
```

## Monitoring & Analytics

### Error Tracking (Sentry)

1. Create a Sentry project
2. Add `SENTRY_DSN` to your environment
3. Install Sentry: `npx expo install @sentry/react-native`
4. Initialize in App.tsx

### Analytics

Consider integrating:
- **Expo Analytics**: Built-in basic analytics
- **Firebase Analytics**: Comprehensive mobile analytics
- **Mixpanel**: Product analytics

## HIPAA Compliance Checklist

Before releasing:

- [ ] All data transmitted over HTTPS
- [ ] Tokens stored in secure storage (expo-secure-store)
- [ ] Biometric authentication available
- [ ] Auto-logout after inactivity
- [ ] Screen capture protection enabled (Android)
- [ ] No PHI in push notification content
- [ ] Privacy policy accessible in-app
- [ ] BAA signed with backend hosting provider
- [ ] Data encryption at rest and in transit

## Troubleshooting

### Build Failures

```bash
# Clear EAS cache
eas build --clear-cache --platform [ios|android]

# Check build logs
eas build:list
eas build:view [build-id]
```

### Common Issues

1. **iOS Provisioning**: Ensure your Apple Developer account is properly linked
2. **Android Signing**: Check that your keystore is configured correctly
3. **Dependencies**: Run `npx expo-doctor` to check for issues

## Version Management

Before each release:

1. Update `version` in `app.json`
2. iOS: `buildNumber` auto-increments with EAS
3. Android: `versionCode` auto-increments with EAS

## Rollback Procedure

If issues are found after release:

1. **OTA Updates**: Revert by publishing a new update
   ```bash
   eas update --branch production --message "Rollback to stable"
   ```

2. **Native Builds**: Submit a new build with the fix
   - Use expedited review on iOS if critical

## Support

- **EAS Documentation**: https://docs.expo.dev/eas/
- **Expo Discord**: https://chat.expo.dev
- **App Store Guidelines**: https://developer.apple.com/app-store/review/guidelines/
- **Play Store Policies**: https://play.google.com/console/about/guides/
