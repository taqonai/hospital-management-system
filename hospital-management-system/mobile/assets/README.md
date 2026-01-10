# App Assets

This directory contains all app icons, splash screens, and other visual assets.

## Required Assets

### App Icons

| File | Size | Description |
|------|------|-------------|
| `icon.png` | 1024x1024 | Main app icon (iOS & Android) |
| `adaptive-icon.png` | 1024x1024 | Android adaptive icon foreground |
| `favicon.png` | 48x48 | Web favicon |

### Splash Screen

| File | Size | Description |
|------|------|-------------|
| `splash.png` | 1284x2778 | Splash screen image |

### Notifications

| File | Size | Description |
|------|------|-------------|
| `notification-icon.png` | 96x96 | Android notification icon (white with transparency) |

## Icon Design Guidelines

### Main Icon (`icon.png`)
- **Size**: 1024x1024 pixels
- **Format**: PNG with transparency
- **Design**: Simple medical/health symbol with HMS branding
- **Colors**: Primary blue (#3B82F6) on white background
- **Corner radius**: Keep content within safe zone (iOS applies rounded corners)

### Adaptive Icon (`adaptive-icon.png`)
- **Size**: 1024x1024 pixels
- **Format**: PNG with transparency
- **Design**: Foreground element only (background set in app.json)
- **Safe zone**: Keep important content within center 66%
- **Background**: Set to #3B82F6 in app.json

### Notification Icon (`notification-icon.png`)
- **Size**: 96x96 pixels
- **Format**: PNG with transparency
- **Design**: White icon on transparent background
- **Style**: Simple silhouette (Android will colorize it)

## Splash Screen Guidelines

### Design
- **Size**: 1284x2778 pixels (iPhone 14 Pro Max)
- **Background**: #3B82F6 (primary blue)
- **Logo**: Center logo/icon, keep within safe area
- **Resize mode**: "contain" (maintains aspect ratio)

### Content
- App logo centered
- Optional: "HMS Patient Portal" text below logo
- Keep minimal - loads quickly

## Generating Assets

### Using Figma/Sketch
1. Design at 1024x1024 for icons
2. Export as PNG with transparency
3. Use consistent branding colors

### Using Online Tools
- [App Icon Generator](https://appicon.co/) - Generate all sizes
- [Expo Icon Builder](https://buildicon.netlify.app/) - Expo-specific
- [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/) - Android adaptive icons

### Using CLI
```bash
# Install sharp-cli for image processing
npm install -g sharp-cli

# Resize icon to notification size
sharp -i icon.png -o notification-icon.png resize 96 96
```

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Primary | #3B82F6 | Main brand color |
| Primary Dark | #2563EB | Darker variant |
| White | #FFFFFF | Icon backgrounds |
| Success | #22C55E | Positive states |
| Error | #EF4444 | Error states |

## File Checklist

Before building, ensure you have:

- [ ] `icon.png` (1024x1024)
- [ ] `adaptive-icon.png` (1024x1024)
- [ ] `splash.png` (1284x2778)
- [ ] `favicon.png` (48x48)
- [ ] `notification-icon.png` (96x96)

## Current Placeholder Assets

The current assets are Expo default placeholders. Replace them with branded assets before production release.
