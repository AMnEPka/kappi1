# Material Design 3 Migration Guide

This document describes the Material Design 3 migration completed for the project.

## Overview

The project has been redesigned to use Material Design 3 (MD3) principles with full offline compatibility. All appearance management has been moved to separate files, and the UI is now modular and completely offline-compatible.

## Architecture

### Directory Structure

```
frontend/src/
├── styles/
│   ├── material3.css          # Material Design 3 CSS variables and global styles
│   ├── layout.css              # Layout-specific styles
│   └── themes/
│       ├── material3.js        # Material Design 3 theme tokens
│       ├── base.js             # Base theme tokens
│       └── yellow-black.js     # Legacy theme (deprecated)
├── components/
│   ├── ui-new/                 # Material Design 3 components
│   │   ├── Button/
│   │   ├── Card/
│   │   ├── Input/
│   │   ├── Textarea/
│   │   ├── Label/
│   │   ├── Badge/
│   │   ├── AppBar/
│   │   └── Sidebar/
│   └── layouts/
│       └── MainLayout.jsx      # Main application layout
└── providers/
    └── ThemeProvider.js        # Material Design 3 theme provider
```

## Components

### Material Design 3 Components

All components are located in `frontend/src/components/ui-new/`:

- **Button**: Filled, Outlined, Text, Elevated, Tonal variants
- **Card**: Container with header, title, description, content, footer
- **Input**: Text input with Material Design 3 styling
- **Textarea**: Multi-line text input
- **Label**: Form labels
- **Badge**: Filled, Outlined, Tonal variants
- **AppBar**: Top application bar
- **Sidebar**: Navigation sidebar

### Usage Example

```jsx
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Label } from '@/components/ui-new';

function MyComponent() {
  return (
    <Card elevation={2}>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <Label>Name</Label>
          <Input placeholder="Enter name" />
        </div>
        <Button variant="filled" size="lg">Submit</Button>
      </CardContent>
    </Card>
  );
}
```

## Theme System

### Theme Tokens

Material Design 3 theme tokens are defined in `frontend/src/styles/themes/material3.js`:

- **Colors**: Primary, Secondary, Tertiary, Error, Neutral, Neutral Variant
- **Typography**: Display, Headline, Title, Body, Label scales
- **Spacing**: Consistent spacing scale
- **Border Radius**: Shape tokens
- **Elevation**: Shadow system
- **Motion**: Duration and easing functions

### CSS Variables

All theme values are exposed as CSS variables in `frontend/src/styles/material3.css`:

```css
--md-sys-color-primary: #636000;
--md-sys-color-on-primary: #FFFFFF;
--md-sys-color-surface: #FDFDFD;
--md-sys-color-on-surface: #1A1A1A;
/* ... and many more */
```

### Theme Provider

The `ThemeProvider` component manages theme state and applies the theme to the document:

```jsx
import { ThemeProvider } from './providers/ThemeProvider';

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      {/* Your app */}
    </ThemeProvider>
  );
}
```

## Layout System

### MainLayout Component

The `MainLayout` component provides:
- App Bar with branding and user info
- Collapsible sidebar navigation
- Breadcrumb navigation
- Main content area with proper spacing

All layout styles are extracted to `frontend/src/components/layouts/MainLayout.css`.

## Offline Compatibility

### Fonts

All fonts are loaded locally. See `OFFLINE_FONTS_SETUP.md` for setup instructions.

**Option 1 (Recommended)**: Use npm packages
```bash
npm install @fontsource/roboto @fontsource/roboto-mono
```

**Option 2**: Download fonts manually to `public/fonts/`

### Icons

Icons are provided by `lucide-react` which is already installed and works offline.

### No CDN Dependencies

- ✅ All CSS is bundled locally
- ✅ All fonts are local
- ✅ All icons are from npm packages
- ✅ No external scripts or stylesheets

## Migration Status

### Completed

- ✅ Material Design 3 theme system
- ✅ Core Material Design 3 components
- ✅ Layout components (AppBar, Sidebar)
- ✅ MainLayout component
- ✅ App.js refactored
- ✅ LoginPage refactored
- ✅ Theme provider with Material Design 3 support

### In Progress

- ⏳ Remaining pages need to be migrated to use Material Design 3 components
- ⏳ Font setup (see OFFLINE_FONTS_SETUP.md)

## Migration Checklist for Pages

When migrating a page to Material Design 3:

1. **Replace imports**:
   ```jsx
   // Old
   import { Button } from '@/components/ui/button';
   import { Card } from '@/components/ui/card';
   
   // New
   import { Button, Card } from '@/components/ui-new';
   ```

2. **Update component props**:
   ```jsx
   // Old
   <Button variant="default">Click</Button>
   
   // New
   <Button variant="filled">Click</Button>
   ```

3. **Remove inline styles**: Move all `className` with Tailwind utilities to separate CSS files
4. **Use Material Design 3 components**: Replace old UI components with new ones
5. **Test offline**: Verify the page works without internet connection

## Component Variants

### Button Variants

- `filled` - Primary action button
- `outlined` - Secondary action with border
- `text` - Text-only button
- `elevated` - Button with elevation
- `tonal` - Tonal button with container color

### Badge Variants

- `filled` - Filled badge
- `outlined` - Outlined badge
- `tonal` - Tonal badge

## Best Practices

1. **Always use Material Design 3 components** from `@/components/ui-new`
2. **Extract styles** to component-specific CSS files
3. **Use CSS variables** for theming instead of hardcoded colors
4. **Follow Material Design 3 guidelines** for spacing, typography, and elevation
5. **Test offline** to ensure no external dependencies

## Resources

- [Material Design 3 Specification](https://m3.material.io/)
- [Material Design 3 Components](https://m3.material.io/components)
- [Offline Fonts Setup](./OFFLINE_FONTS_SETUP.md)

