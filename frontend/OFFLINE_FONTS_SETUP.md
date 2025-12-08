# Offline Fonts Setup Guide

This project uses Material Design 3 with local fonts to ensure full offline functionality. All fonts are bundled locally and do not require internet access.

## Font Requirements

The project uses:
- **Roboto** (Regular, Medium, Bold, Light)
- **Roboto Mono** (Regular, Medium)

## Setup Options

### Option 1: Using npm packages (Recommended)

Install font packages that bundle fonts locally:

```bash
npm install @fontsource/roboto @fontsource/roboto-mono
```

Then update `frontend/src/styles/material3.css` to import from node_modules:

```css
@import '@fontsource/roboto/300.css';
@import '@fontsource/roboto/400.css';
@import '@fontsource/roboto/500.css';
@import '@fontsource/roboto/700.css';
@import '@fontsource/roboto-mono/400.css';
@import '@fontsource/roboto-mono/500.css';
```

### Option 2: Manual Download

1. Download fonts from [Google Fonts](https://fonts.google.com/specimen/Roboto) or [GitHub](https://github.com/google/fonts/tree/main/apache/roboto)
2. Create the following directory structure:
   ```
   frontend/public/fonts/
   ├── roboto/
   │   ├── Roboto-Light.woff2
   │   ├── Roboto-Light.woff
   │   ├── Roboto-Regular.woff2
   │   ├── Roboto-Regular.woff
   │   ├── Roboto-Medium.woff2
   │   ├── Roboto-Medium.woff
   │   ├── Roboto-Bold.woff2
   │   └── Roboto-Bold.woff
   └── roboto-mono/
       ├── RobotoMono-Regular.woff2
       ├── RobotoMono-Regular.woff
       ├── RobotoMono-Medium.woff2
       └── RobotoMono-Medium.woff
   ```

3. The CSS in `frontend/src/styles/material3.css` already references these paths.

## Verification

After setup, verify fonts are loading:
1. Build the project: `npm run build`
2. Check the build output for font files in `build/fonts/`
3. Test in offline mode to ensure fonts load correctly

## Icons

Icons are provided by `lucide-react` which is already installed and works offline. No additional setup needed.

